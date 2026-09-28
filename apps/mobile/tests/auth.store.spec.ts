jest.mock('../lib/api-client', () => ({
  getAuthTokens: jest.fn(),
  setAuthTokens: jest.fn(),
}));

jest.mock('../lib/secure-storage', () => ({
  saveTokens: jest.fn(),
  loadTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

jest.mock('../lib/api/auth', () => ({
  getMe: jest.fn(),
}));

import type { AuthTokens, User } from '@focus/shared-types';
import { useAuthStore } from '../stores/auth.store';
import { getAuthTokens, setAuthTokens } from '../lib/api-client';
import { clearTokens, loadTokens, saveTokens } from '../lib/secure-storage';
import { getMe } from '../lib/api/auth';

const tokens: AuthTokens = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const rotatedTokens: AuthTokens = { accessToken: 'access-2', refreshToken: 'refresh-2' };
const user: User = {
  id: 'user-1',
  email: 'user@example.com',
  phone: null,
  timezone: 'Europe/Moscow',
    timeFormat: 'SYSTEM',
  hasCompletedOnboarding: true,
  plan: 'FREE',
  proExpiresAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('auth store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      sessionGeneration: 0,
    });
    (clearTokens as jest.Mock).mockResolvedValue(undefined);
    (saveTokens as jest.Mock).mockResolvedValue(undefined);
    (getAuthTokens as jest.Mock).mockReturnValue(tokens);
  });

  it('resolves a fresh app without tokens as unauthenticated', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(null);

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      sessionGeneration: 1,
    });
    expect(setAuthTokens).toHaveBeenCalledWith(null);
    expect(getMe).not.toHaveBeenCalled();
  });

  it('authenticates only after stored tokens pass GET /auth/me', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(tokens);
    (getMe as jest.Mock).mockResolvedValue(user);

    await useAuthStore.getState().bootstrap();

    expect(setAuthTokens).toHaveBeenCalledWith(tokens);
    expect(useAuthStore.getState()).toMatchObject({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: true,
      isLoading: false,
      sessionGeneration: 1,
    });
  });

  it('clears an invalid stored session', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(tokens);
    (getMe as jest.Mock).mockRejectedValue(new Error('401'));

    await useAuthStore.getState().bootstrap();

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      sessionGeneration: 1,
    });
  });

  it('rotates tokens in an authenticated session without changing its generation', async () => {
    useAuthStore.setState({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: true,
      isLoading: false,
      sessionGeneration: 7,
    });

    await useAuthStore.getState().setTokens(rotatedTokens);

    expect(saveTokens).toHaveBeenCalledWith(rotatedTokens);
    expect(setAuthTokens).toHaveBeenCalledWith(rotatedTokens);
    expect(useAuthStore.getState()).toMatchObject({
      user,
      accessToken: rotatedTokens.accessToken,
      refreshToken: rotatedTokens.refreshToken,
      isAuthenticated: true,
      sessionGeneration: 7,
    });
  });

  it('does not expose a token-only session while authenticate verifies the user', async () => {
    let resolveUser!: (value: User) => void;
    (getMe as jest.Mock).mockReturnValue(new Promise<User>((resolve) => { resolveUser = resolve; }));

    const pending = useAuthStore.getState().authenticate(tokens);
    await Promise.resolve();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });

    resolveUser(user);
    await pending;
    expect(useAuthStore.getState()).toMatchObject({
      user,
      isAuthenticated: true,
      sessionGeneration: 1,
    });
  });

  it('clears state synchronously when logout begins', async () => {
    useAuthStore.setState({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: true,
      isLoading: false,
      sessionGeneration: 4,
    });

    const pending = useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      sessionGeneration: 5,
    });
    await pending;
  });
});
