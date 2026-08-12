import { create } from 'zustand';
import type { AuthTokens, User } from '@focus/shared-types';
import { getAuthTokens, setAuthTokens } from '../lib/api-client';
import { saveTokens, loadTokens, clearTokens } from '../lib/secure-storage';
import { getMe } from '../lib/api/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** true до завершения bootstrap() при старте приложения — пока неизвестно, есть ли сессия */
  isLoading: boolean;

  setTokens: (tokens: AuthTokens) => Promise<void>;
  authenticate: (tokens: AuthTokens) => Promise<User>;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  /** Вызывается один раз при старте приложения (см. app/_layout.tsx) */
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (tokens) => {
    await saveTokens(tokens);
    setAuthTokens(tokens);
    set((state) =>
      state.isAuthenticated
        ? { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        : {},
    );
  },

  authenticate: async (tokens) => {
    try {
      await saveTokens(tokens);
      setAuthTokens(tokens);
      const user = await getMe();
      const verifiedTokens = getAuthTokens();
      if (!verifiedTokens) throw new Error('Authentication tokens were cleared during verification');
      set({
        user,
        accessToken: verifiedTokens.accessToken,
        refreshToken: verifiedTokens.refreshToken,
        isAuthenticated: true,
      });
      return user;
    } catch (error) {
      setAuthTokens(null);
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      await clearTokens().catch(() => {});
      throw error;
    }
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    setAuthTokens(null);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    // In-memory/API auth state must remain cleared even if SecureStore is
    // temporarily unavailable (for example during an OS-level storage error).
    await clearTokens().catch(() => {});
  },

  /**
   * Пытается восстановить сессию из SecureStore и проверяет её через GET /auth/me
   * (accessToken мог протухнуть за время, что приложение не открывали — тогда
   * интерцептор в api-client.ts сам обновит его через refreshToken, который
   * мы кладём в state ДО вызова getMe(), чтобы интерцептор успел его увидеть).
   */
  bootstrap: async () => {
    try {
      const tokens = await loadTokens();
      if (!tokens) {
        setAuthTokens(null);
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      setAuthTokens(tokens);

      const user = await getMe();
      const verifiedTokens = getAuthTokens();
      if (!verifiedTokens) throw new Error('Authentication tokens were cleared during bootstrap');

      set({
        isAuthenticated: true,
        user,
        accessToken: verifiedTokens.accessToken,
        refreshToken: verifiedTokens.refreshToken,
        isLoading: false,
      });
    } catch {
      setAuthTokens(null);
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
      await clearTokens().catch(() => {});
    }
  },
}));
