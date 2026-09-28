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

let fetchSeq = 0;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
        const seq = ++fetchSeq;
        set({ isLoading: true });
        try {
          const user = await api.get<User>('/users/me');
          if (seq !== fetchSeq) return;
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: unknown) {
          if (seq !== fetchSeq) return;
          const status = (error as { response?: { status?: number } })?.response
            ?.status;
          if (status === 401 || status === 403) {
            api.clearTokens();
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
          }
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
