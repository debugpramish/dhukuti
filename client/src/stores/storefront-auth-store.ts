import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { loginCustomer, registerCustomer } from '@/features/storefront/api/storefrontApi';
import type { AuthUser, LoginInput, RegisterInput } from '@/features/storefront/types';

type StorefrontAuthState = {
  user: AuthUser | null;
  token: string;
  isAuthenticated: boolean;
  isAuthPending: boolean;
  authError: string | null;
  login: (credentials: LoginInput) => Promise<void>;
  register: (payload: RegisterInput) => Promise<void>;
  logout: () => void;
  clearAuthError: () => void;
};

export const useStorefrontAuthStore = create<StorefrontAuthState>()(
  persist(
    (set) => ({
      user: null,
      token: '',
      isAuthenticated: false,
      isAuthPending: false,
      authError: null,
      login: async (credentials) => {
        set({ isAuthPending: true, authError: null });

        try {
          const result = await loginCustomer(credentials);
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isAuthPending: false,
            authError: null,
          });
        } catch (error) {
          set({
            isAuthPending: false,
            isAuthenticated: false,
            authError: error instanceof Error ? error.message : 'Unable to login',
          });
          throw error;
        }
      },
      register: async (payload) => {
        set({ isAuthPending: true, authError: null });

        try {
          const result = await registerCustomer(payload);
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isAuthPending: false,
            authError: null,
          });
        } catch (error) {
          set({
            isAuthPending: false,
            isAuthenticated: false,
            authError: error instanceof Error ? error.message : 'Unable to register account',
          });
          throw error;
        }
      },
      logout: () =>
        set({
          user: null,
          token: '',
          isAuthenticated: false,
          isAuthPending: false,
          authError: null,
        }),
      clearAuthError: () => set({ authError: null }),
    }),
    {
      name: 'dhukuti-storefront-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
