import { YandexOAuthController } from './yandex-oauth.controller';
import { VkOAuthController } from './vk-oauth.controller';
import { MailruOAuthController } from './mailru-oauth.controller';

const tokens = { accessToken: 'access', refreshToken: 'refresh' };
const response = () => {
  const res = { redirect: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

async function invoke(Controller: typeof YandexOAuthController | typeof VkOAuthController | typeof MailruOAuthController, instance: any, code: string | undefined, res: any) {
  if (Controller === VkOAuthController) {
    return instance.handleCallback(code, undefined, undefined, res);
  }
  return instance.handleCallback(code, undefined, res);
}

describe('OAuth controllers external transport', () => {
  const oauth = { handleOAuthCallback: jest.fn().mockResolvedValue(tokens) };
  const transport = { requestJson: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['Yandex', YandexOAuthController, 'yandex', [{ access_token: 'provider-access' }, { id: 'y-1', default_email: 'y@example.test' }], ['yandex.token', 'none', 'yandex.profile', 'safe-transient']],
    ['VK', VkOAuthController, 'vk', [{ access_token: 'provider-access', user_id: 42, email: 'v@example.test' }, { response: [{ first_name: 'V' }] }], ['vk.token', 'none', 'vk.profile', 'safe-transient']],
    ['Mail.ru', MailruOAuthController, 'mailru', [{ access_token: 'provider-access' }, [{ uid: 'm-1', email: 'm@example.test' }]], ['mailru.token', 'none', 'mailru.profile', 'safe-transient']],
  ] as const)('%s selects explicit token/profile operations and preserves deep-link success', async (_name, Controller, _provider, replies, expected) => {
    transport.requestJson.mockResolvedValueOnce(replies[0]).mockResolvedValueOnce(replies[1]);
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), 'code', res);
    expect(transport.requestJson).toHaveBeenNthCalledWith(1, expect.objectContaining({ operation: expected[0], retry: expected[1] }));
    expect(transport.requestJson).toHaveBeenNthCalledWith(2, expect.objectContaining({ operation: expected[2], retry: expected[3] }));
    expect(oauth.handleOAuthCallback).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('focus://auth/callback'));
  });

  it.each([YandexOAuthController, VkOAuthController, MailruOAuthController])('keeps missing code at 400 without transport (%p)', async (Controller) => {
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), undefined, res);
    expect(transport.requestJson).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it.each([YandexOAuthController, VkOAuthController, MailruOAuthController])('redacts transport failure and prevents issuance (%p)', async (Controller) => {
    transport.requestJson.mockRejectedValueOnce(new Error('provider secret and code'));
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), 'code', res);
    expect(oauth.handleOAuthCallback).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ error: expect.anything(), description: expect.anything() }));
  });
});
