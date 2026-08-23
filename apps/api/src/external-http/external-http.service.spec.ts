import { ExternalHttpError } from './external-http.error';
import { ExternalHttpService } from './external-http.service';

describe('ExternalHttpService', () => {
  const service = new ExternalHttpService();

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

  it('performs exactly one retry for a safe transient HTTP response', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) }) as any;
    await expect(service.requestJson({ operation: 'vk.profile', url: 'https://provider.invalid', retry: 'safe-transient' })).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['vk.token', 'none'],
    ['expo.push', 'none'],
  ] as const)('does not retry %s even when the request is GET', async (operation, retry) => {
    global.fetch = jest.fn().mockRejectedValue(new Error('secret URL and token')) as any;
    await expect(service.requestJson({ operation, url: 'https://provider.invalid?secret=1', retry })).rejects.toMatchObject({ failureClass: 'network', attempts: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-transient HTTP or malformed JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 }) as any;
    await expect(service.requestJson({ operation: 'mailru.profile', url: 'https://provider.invalid', retry: 'safe-transient' })).rejects.toMatchObject({ failureClass: 'http', status: 400 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('provider body'); } }) as any;
    await expect(service.requestJson({ operation: 'mailru.profile', url: 'https://provider.invalid', retry: 'safe-transient' })).rejects.toMatchObject({ failureClass: 'invalid-response' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts at the single total deadline and exposes only a safe error', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('raw secret failure'))))) as any;
    const request = service.requestJson({ operation: 'yandex.profile', url: 'https://provider.invalid?code=secret', retry: 'safe-transient' });
    const observed: Promise<ExternalHttpError> = request.then(
      () => { throw new Error('expected request to fail'); },
      (caught) => caught as ExternalHttpError,
    );
    await jest.advanceTimersByTimeAsync(5_000);
    const error = await observed;
    expect(error).toMatchObject({ failureClass: 'timeout', operation: 'yandex.profile' });
    expect(error.message).not.toMatch(/provider|secret|code=/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
