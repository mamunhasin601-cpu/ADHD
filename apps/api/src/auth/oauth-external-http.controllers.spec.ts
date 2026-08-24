import { YandexOAuthController } from './yandex-oauth.controller';
import { VkOAuthController } from './vk-oauth.controller';
import { MailruOAuthController } from './mailru-oauth.controller';
import {
  OAuthAccountLinkingRequiredError,
  OAUTH_ACCOUNT_LINKING_REQUIRED_RESPONSE,
} from './oauth-account-linking.error';

const tokens = { accessToken: 'access', refreshToken: 'refresh' };
const response = () => {
  const res = { redirect: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

async function invoke(
  Controller: typeof YandexOAuthController | typeof VkOAuthController | typeof MailruOAuthController,
  instance: any,
  code: string | undefined,
  res: any,
  error?: string,
) {
  if (Controller === VkOAuthController) {
    return instance.handleCallback(code, error, 'provider description and secret', res);
  }
  return instance.handleCallback(code, error, res);
}

describe('OAuth controllers external transport', () => {
  const oauth = { handleOAuthCallback: jest.fn().mockResolvedValue(tokens) };
  const transport = { requestJson: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['Yandex', YandexOAuthController, { access_token: 'provider-access' }, { id: 'y-1', default_email: 'y@example.test', first_name: 'Y' }, ['yandex.token', 'none', 'yandex.profile', 'safe-transient'], { provider: 'yandex', providerId: 'y-1', email: 'y@example.test', firstName: 'Y', lastName: undefined }],
    ['VK', VkOAuthController, { access_token: 'provider-access', user_id: 42, email: 'v@example.test' }, { response: [{ first_name: 'V', last_name: 'K' }] }, ['vk.token', 'none', 'vk.profile', 'safe-transient'], { provider: 'vk', providerId: '42', email: 'v@example.test', firstName: 'V', lastName: 'K' }],
    ['Mail.ru', MailruOAuthController, { access_token: 'provider-access' }, [{ uid: 'm-1', email: 'm@example.test', first_name: 'M', last_name: 'R' }], ['mailru.token', 'none', 'mailru.profile', 'safe-transient'], { provider: 'mailru', providerId: 'm-1', email: 'm@example.test', firstName: 'M', lastName: 'R' }],
  ] as const)('%s selects explicit operations, maps a profile, and preserves deep-link tokens', async (_name, Controller, tokenReply, profileReply, expected, profile) => {
    transport.requestJson.mockResolvedValueOnce(tokenReply).mockResolvedValueOnce(profileReply);
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), 'code', res);
    expect(transport.requestJson).toHaveBeenNthCalledWith(1, expect.objectContaining({ operation: expected[0], retry: expected[1] }));
    expect(transport.requestJson).toHaveBeenNthCalledWith(2, expect.objectContaining({ operation: expected[2], retry: expected[3] }));
    expect(oauth.handleOAuthCallback).toHaveBeenCalledWith(profile);
    const deepLink = res.redirect.mock.calls[0][0];
    expect(deepLink).toContain('focus://auth/callback');
    expect(deepLink).toContain('accessToken=access');
    expect(deepLink).toContain('refreshToken=refresh');
  });

  it.each([YandexOAuthController, VkOAuthController, MailruOAuthController])('keeps missing code at 400 without transport (%p)', async (Controller) => {
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), undefined, res);
    expect(transport.requestJson).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it.each([YandexOAuthController, VkOAuthController, MailruOAuthController])('redacts provider callback errors at 400 without transport (%p)', async (Controller) => {
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), 'code', res, 'provider-error-secret');
    expect(transport.requestJson).not.toHaveBeenCalled();
    expect(oauth.handleOAuthCallback).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/provider-error-secret|description|code|secret|token|error/i);
  });

  it.each([YandexOAuthController, VkOAuthController, MailruOAuthController])('redacts transport failure and prevents issuance (%p)', async (Controller) => {
    transport.requestJson.mockRejectedValueOnce(new Error('provider secret and code'));
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), 'code', res);
    expect(oauth.handleOAuthCallback).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ error: expect.anything(), description: expect.anything() }));
  });

  it.each([
    ['Yandex', YandexOAuthController, { error: 'secret provider payload' }],
    ['VK', VkOAuthController, { error: 'secret provider payload' }],
    ['Mail.ru', MailruOAuthController, { error: 'secret provider payload' }],
  ] as const)('%s rejects an HTTP-200 token payload without profile lookup or disclosure', async (_name, Controller, tokenReply) => {
    transport.requestJson.mockResolvedValueOnce(tokenReply);
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), 'callback-code-secret', res);
    expect(transport.requestJson).toHaveBeenCalledTimes(1);
    expect(oauth.handleOAuthCallback).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/secret|payload|code|token|error|description/i);
  });

  it.each([YandexOAuthController, VkOAuthController, MailruOAuthController])('prevents issuance when profile transport fails (%p)', async (Controller) => {
    transport.requestJson
      .mockResolvedValueOnce(Controller === VkOAuthController ? { access_token: 'provider', user_id: 1 } : { access_token: 'provider' })
      .mockRejectedValueOnce(new Error('provider response URL token secret'));
    const res = response();
    await invoke(Controller, new Controller(oauth as any, transport as any), 'callback-code-secret', res);
    expect(transport.requestJson).toHaveBeenCalledTimes(2);
    expect(oauth.handleOAuthCallback).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/provider|response|URL|token|secret|code|error|description/i);
  });

  it.each([
    ['Yandex', YandexOAuthController, { access_token: 'provider-access' }, { id: 'y-1', default_email: 'existing@example.test' }],
    ['VK', VkOAuthController, { access_token: 'provider-access', user_id: 42, email: 'existing@example.test' }, { response: [{}] }],
    ['Mail.ru', MailruOAuthController, { access_token: 'provider-access' }, [{ uid: 'm-1', email: 'existing@example.test' }]],
  ] as const)('%s maps linking-required to the shared safe 409 without redirect', async (_name, Controller, tokenReply, profileReply) => {
    transport.requestJson.mockResolvedValueOnce(tokenReply).mockResolvedValueOnce(profileReply);
    oauth.handleOAuthCallback.mockRejectedValueOnce(
      new OAuthAccountLinkingRequiredError(),
    );
    const res = response();

    await invoke(Controller, new Controller(oauth as any, transport as any), 'sensitive-code', res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      OAUTH_ACCOUNT_LINKING_REQUIRED_RESPONSE,
    );
    expect(res.redirect).not.toHaveBeenCalled();
    const serialized = JSON.stringify(res.json.mock.calls[0][0]);
    expect(serialized).not.toMatch(/existing@example|sensitive-code|provider-access|accessToken|refreshToken/);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace-only', '   '],
  ])(
    'rejects a %s Yandex profile ID with a generic failure and no issuance',
    async (_name, providerId) => {
      transport.requestJson
        .mockResolvedValueOnce({ access_token: 'provider-access' })
        .mockResolvedValueOnce({
          id: providerId,
          default_email: 'provider-content@example.test',
        });
      const res = response();

      await invoke(
        YandexOAuthController,
        new YandexOAuthController(oauth as any, transport as any),
        'sensitive-code',
        res,
      );

      expect(oauth.handleOAuthCallback).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      const serialized = JSON.stringify(res.json.mock.calls[0][0]);
      expect(serialized).not.toMatch(
        /provider-content|sensitive-code|provider-access|accessToken|refreshToken|undefined|null|object/i,
      );
    },
  );
});
