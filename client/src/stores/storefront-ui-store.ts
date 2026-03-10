import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export type StorefrontToast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type StorefrontUiState = {
  isCartDrawerOpen: boolean;
  toasts: StorefrontToast[];
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleCartDrawer: () => void;
  pushToast: (toast: Omit<StorefrontToast, 'id'>) => string;
  removeToast: (id: string) => void;
};

export const useStorefrontUiStore = create<StorefrontUiState>()((set) => ({
  isCartDrawerOpen: false,
  toasts: [],
  openCartDrawer: () => set({ isCartDrawerOpen: true }),
  closeCartDrawer: () => set({ isCartDrawerOpen: false }),
  toggleCartDrawer: () => set((state) => ({ isCartDrawerOpen: !state.isCartDrawerOpen })),
  pushToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
