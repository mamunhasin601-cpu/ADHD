jest.mock('axios', () => {
  const client = jest.fn();
  (client as any).defaults = { headers: { common: {} } };
  (client as any).interceptors = {
    response: { use: jest.fn() },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => client),
      post: jest.fn(),
    },
  };
});

jest.mock('../stores/auth.store', () => ({
  useAuthStore: { getState: jest.fn() },
}));

import type { AuthTokens } from '@focus/shared-types';
import axios from 'axios';
import { apiClient, setAuthTokens } from '../lib/api-client';
import { useAuthStore } from '../stores/auth.store';

const oldTokens: AuthTokens = { accessToken: 'old-access', refreshToken: 'refresh-1' };
const newTokens: AuthTokens = { accessToken: 'new-access', refreshToken: 'refresh-2' };

describe('api client refresh interceptor', () => {
  const mockApiClient = apiClient as unknown as jest.Mock;
  const mockAxiosPost = axios.post as jest.Mock;
  const mockGetState = useAuthStore.getState as jest.Mock;
  const responseRejected = (apiClient.interceptors.response.use as jest.Mock).mock.calls[0][1] as (
    error: unknown,
  ) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthTokens(oldTokens);
    mockGetState.mockReturnValue({
      refreshToken: oldTokens.refreshToken,
      setTokens: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn().mockResolvedValue(undefined),
    });
    mockApiClient.mockImplementation((config: Record<string, unknown>) =>
      Promise.resolve({ status: 200, config }),
    );
  });

  it('uses one refresh request for three simultaneous 401 responses', async () => {
    let resolveRefresh!: (value: { data: AuthTokens }) => void;
    mockAxiosPost.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));

    const errors = [1, 2, 3].map((id) => ({
      response: { status: 401 },
      config: { url: `/tasks/${id}`, headers: {} },
    }));
    const pending = errors.map((error) => responseRejected(error));

    await Promise.resolve();
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);

    resolveRefresh({ data: newTokens });
    const responses = await Promise.all(pending);

    expect(responses).toHaveLength(3);
    expect(mockApiClient).toHaveBeenCalledTimes(3);
    expect(mockApiClient.mock.calls.every(([config]) =>
      (config.headers as Record<string, string>).Authorization === 'Bearer new-access',
    )).toBe(true);
  });

  it('logs out once and rejects all requests when refresh fails', async () => {
    mockAxiosPost.mockRejectedValue(new Error('refresh failed'));
    const logout = jest.fn().mockResolvedValue(undefined);
    mockGetState.mockReturnValue({
      refreshToken: oldTokens.refreshToken,
      setTokens: jest.fn(),
      logout,
    });

    const errors = [1, 2, 3].map((id) => ({
      response: { status: 401 },
      config: { url: `/tasks/${id}`, headers: {} },
    }));
    const results = await Promise.allSettled(errors.map((error) => responseRejected(error)));

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
  });

  it('does not retry a request already marked _retry', async () => {
    await expect(responseRejected({
      response: { status: 401 },
      config: { _retry: true },
    })).rejects.toMatchObject({ response: { status: 401 } });
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });
});
