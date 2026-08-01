import { create } from 'zustand';
import type { AuthTokens, User } from '@focus/shared-types';
import { setAuthToken } from '../lib/api-client';
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
    setAuthToken(tokens.accessToken);
    await saveTokens(tokens);
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: true,
    });
  },

  setUser: (user) => set({ user }),

  logout: async () => {
    setAuthToken(null);
    await clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
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
        set({ isLoading: false });
        return;
      }

      setAuthToken(tokens.accessToken);
      set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

      const user = await getMe();

      set({ isAuthenticated: true, user, isLoading: false });
    } catch {
      await clearTokens();
      setAuthToken(null);
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
