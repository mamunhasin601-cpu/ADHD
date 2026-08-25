import { apiClient } from '../api-client';
import { confirmContactVerification, registerVerified, startContactVerification } from './auth';

jest.mock('../api-client', () => ({ apiClient: { post: jest.fn() } }));

describe('verified registration API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts a contact challenge with the typed channel and destination', async () => {
    const response = { challengeId: 'challenge', expiresInSeconds: 600, resendAfterSeconds: 60 };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: response });
    await expect(startContactVerification({ channel: 'EMAIL', destination: 'user@example.ru' })).resolves.toEqual(response);
    expect(apiClient.post).toHaveBeenCalledWith('/auth/contact-verification/start', { channel: 'EMAIL', destination: 'user@example.ru' });
  });

  it('confirms a challenge without changing its opaque identifiers', async () => {
    const response = { verificationToken: 'opaque-ticket', expiresInSeconds: 600 };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: response });
    await expect(confirmContactVerification({ challengeId: 'opaque-challenge', code: '123456' })).resolves.toEqual(response);
    expect(apiClient.post).toHaveBeenCalledWith('/auth/contact-verification/confirm', { challengeId: 'opaque-challenge', code: '123456' });
  });

  it('registers with the matching verification ticket', async () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    (apiClient.post as jest.Mock).mockResolvedValue({ data: tokens });
    await expect(registerVerified({ email: 'user@example.ru', password: 'password', emailVerificationToken: 'opaque-ticket' })).resolves.toEqual(tokens);
    expect(apiClient.post).toHaveBeenCalledWith('/auth/register', { email: 'user@example.ru', password: 'password', emailVerificationToken: 'opaque-ticket' });
  });
});
