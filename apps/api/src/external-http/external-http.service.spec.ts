import { ExternalHttpError } from './external-http.error';
import { ExternalHttpService } from './external-http.service';

describe('ExternalHttpService', () => {
  const service = new ExternalHttpService();

  beforeEach(() => {
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns JSON on the first attempt and forwards an AbortSignal', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }) as any;
    await expect(service.requestJson({ operation: 'yandex.profile', url: 'https://provider.invalid/private', retry: 'safe-transient' })).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('retries one transient response, releases its body, and does not log the intermediate failure', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const warn = jest.spyOn((service as any).logger, 'warn');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, body: { cancel } })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) }) as any;
    await expect(service.requestJson({ operation: 'vk.profile', url: 'https://provider.invalid', retry: 'safe-transient' })).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('bounds never-settling retryable response cleanup and performs the permitted retry', async () => {
    jest.useFakeTimers();
    const cancel = jest.fn(() => new Promise<void>(() => undefined));
    const warn = jest.spyOn((service as any).logger, 'warn');
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, body: { cancel } })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ recovered: true }) }) as any;

    const request = service.requestJson({ operation: 'vk.profile', url: 'https://provider.invalid', retry: 'safe-transient' });
    await jest.advanceTimersByTimeAsync(2_400);
    await jest.advanceTimersByTimeAsync(100);

    await expect(request).resolves.toEqual({ recovered: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('releases a terminal non-retryable response body and logs one redacted failure', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const warn = jest.spyOn((service as any).logger, 'warn');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, body: { cancel } }) as any;
    await expect(service.requestJson({
      operation: 'mailru.profile', url: 'https://secret.invalid/path?token=provider-secret',
      options: { method: 'post', headers: { Authorization: 'Bearer secret' }, body: 'raw-body' }, retry: 'safe-transient',
    })).rejects.toMatchObject({ failureClass: 'http', status: 400, attempts: 1 });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls[0][0]);
    expect(logged).toContain('external-http.failure');
    expect(logged).toContain('POST');
    expect(logged).not.toMatch(/secret|invalid\.invalid|raw-body|token=/i);
  });

  it('bounds never-settling terminal response cleanup at the total deadline and logs once', async () => {
    jest.useFakeTimers();
    const cancel = jest.fn(() => new Promise<void>(() => undefined));
    const warn = jest.spyOn((service as any).logger, 'warn');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, body: { cancel } }) as any;

    const request = service.requestJson({ operation: 'expo.push', url: 'https://provider.invalid', retry: 'none' });
    const observed = request.then(() => { throw new Error('expected request to fail'); }, (caught) => caught as ExternalHttpError);
    await jest.advanceTimersByTimeAsync(4_999);
    expect(warn).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    await expect(observed).resolves.toMatchObject({ failureClass: 'http', status: 400, attempts: 1 });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['vk.token', 'none'],
    ['expo.push', 'none'],
  ] as const)('does not retry %s even when the request is GET', async (operation, retry) => {
    global.fetch = jest.fn().mockRejectedValue(new Error('secret URL and token')) as any;
    await expect(service.requestJson({ operation, url: 'https://provider.invalid?secret=1', retry })).rejects.toMatchObject({ failureClass: 'network', attempts: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry malformed JSON and classifies it as invalid-response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('provider body'); } }) as any;
    await expect(service.requestJson({ operation: 'mailru.profile', url: 'https://provider.invalid', retry: 'safe-transient' })).rejects.toMatchObject({ failureClass: 'invalid-response' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a body-consumption timeout within the total deadline', async () => {
    jest.useFakeTimers();
    let firstSignal: AbortSignal | undefined;
    global.fetch = jest.fn((_url, init: RequestInit) => {
      if (!firstSignal) {
        firstSignal = init.signal as AbortSignal;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => new Promise((_resolve, reject) => firstSignal?.addEventListener('abort', () => reject(new Error('secret body error')))),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ recovered: true }) });
    }) as any;
    const request = service.requestJson({ operation: 'yandex.profile', url: 'https://provider.invalid', retry: 'safe-transient' });
    await jest.advanceTimersByTimeAsync(2_400);
    await jest.advanceTimersByTimeAsync(100);
    await expect(request).resolves.toEqual({ recovered: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('fails invalid URLs before fetch without disclosing them', async () => {
    const warn = jest.spyOn((service as any).logger, 'warn');
    await expect(service.requestJson({ operation: 'yandex.token', url: 'http://secret.invalid/private?code=secret' })).rejects.toMatchObject({ failureClass: 'invalid-request', attempts: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls[0][0])).not.toMatch(/secret|http:/i);
  });

  it('uses one full remaining deadline for non-retryable operations', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('raw secret failure'))))) as any;
    const request = service.requestJson({ operation: 'expo.push', url: 'https://provider.invalid?code=secret', retry: 'none' });
    const observed: Promise<ExternalHttpError> = request.then(() => { throw new Error('expected request to fail'); }, (caught) => caught as ExternalHttpError);
    await jest.advanceTimersByTimeAsync(5_000);
    const error = await observed;
    expect(error).toMatchObject({ failureClass: 'timeout', operation: 'expo.push', attempts: 1 });
    expect(error.message).not.toMatch(/provider|secret|code=/);
  });
});
