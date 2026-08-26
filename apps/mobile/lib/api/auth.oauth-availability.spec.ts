import { parseOAuthProviderAvailability } from './auth';

describe('parseOAuthProviderAvailability', () => {
  it('accepts the exact provider flag contract', () => {
    expect(parseOAuthProviderAvailability({ yandex: true, vk: false, mailru: true })).toEqual({
      yandex: true,
      vk: false,
      mailru: true,
    });
  });

  it.each([
    null,
    [],
    { yandex: true, vk: false },
    { yandex: true, vk: false, mailru: false, google: true },
    { yandex: 'true', vk: false, mailru: false },
  ])('rejects malformed or broadened payloads: %p', (payload) => {
    expect(() => parseOAuthProviderAvailability(payload)).toThrow('Invalid OAuth provider availability');
  });
});
