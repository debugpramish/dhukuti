import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { loginCustomer, registerCustomer } from '@/features/storefront/api/storefrontApi';
import type { AuthUser, LoginInput, RegisterInput } from '@/features/storefront/types';

const STOREFRONT_SLUG_STORAGE_KEY = 'dhukuti:storefront:slug';
const ENV_STOREFRONT_SLUG = String(import.meta.env.VITE_STOREFRONT_SLUG || '').trim().toLowerCase();

function getActiveStoreSlug(): string {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const slugFromUrl = String(params.get('store') || '').trim().toLowerCase();
      if (slugFromUrl) {
        return slugFromUrl;
      }
    } catch {
      // Ignore malformed URLs.
    }

    try {
      const storedSlug = window.localStorage.getItem(STOREFRONT_SLUG_STORAGE_KEY) || '';
      if (storedSlug.trim()) {
        return storedSlug.trim().toLowerCase();
      }
    } catch {
      // Ignore storage read failures.
    }
  }

  return ENV_STOREFRONT_SLUG;
}

type StorefrontAuthState = {
  user: AuthUser | null;
  token: string;
  isAuthenticated: boolean;
  isAuthPending: boolean;
  authError: string | null;
  storeSlug: string;
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
      storeSlug: getActiveStoreSlug(),
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
            storeSlug: getActiveStoreSlug(),
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
            storeSlug: getActiveStoreSlug(),
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
          storeSlug: getActiveStoreSlug(),
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
        storeSlug: state.storeSlug,
      }),
      onRehydrateStorage: () => (state, _error) => {
        const activeSlug = getActiveStoreSlug();
        if (!state) {
          return;
        }

        // If the persisted auth belongs to a different store, clear it so credentials are not shared across stores.
        if (state.storeSlug && activeSlug && state.storeSlug !== activeSlug) {
          set({
            user: null,
            token: '',
            isAuthenticated: false,
            isAuthPending: false,
            authError: null,
            storeSlug: activeSlug,
          });
        } else if (!state.storeSlug) {
          set({
            user: null,
            token: '',
            isAuthenticated: false,
            isAuthPending: false,
            authError: null,
            storeSlug: activeSlug,
          });
        }
      },
    },
  ),
);
