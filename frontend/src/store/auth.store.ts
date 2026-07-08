import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthTokens } from '@/types';
import { api } from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: AuthTokens) => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: (tokens: AuthTokens) => {
        api.setTokens(tokens.accessToken, tokens.refreshToken);
        set({ user: tokens.user, isAuthenticated: true });
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {}
        api.clearTokens();
        set({ user: null, isAuthenticated: false });
      },

      setUser: (user: User) => set({ user }),

      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const user = await api.get<User>('/users/me');
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
