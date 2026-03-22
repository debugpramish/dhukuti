import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { CartItem, StorefrontProduct } from '@/features/storefront/types';

const MAX_ITEM_QUANTITY = 20;
const STOREFRONT_CART_STORAGE_KEY = 'dhukuti-storefront-cart';
const LEGACY_STORE_CART_STORAGE_PREFIX = 'dhukuti:store-cart:';

function calculateCartTotal(items: CartItem[]): number {
  return Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
}

type AddItemInput = {
  product: StorefrontProduct;
  quantity?: number;
  variantId?: string;
  variantLabel?: string;
};

type StorefrontCartState = {
  items: CartItem[];
  cartTotal: number;
  addItem: (payload: AddItemInput) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
};

export const useStorefrontCartStore = create<StorefrontCartState>()(
  persist(
    (set) => ({
      items: [],
      cartTotal: 0,
      addItem: ({ product, quantity = 1, variantId, variantLabel }) =>
        set((state) => {
          const safeQuantity = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(quantity)));
          const existingIndex = state.items.findIndex(
            (item) => item.productId === product.id && item.variantId === variantId,
          );

          let nextItems: CartItem[];

          if (existingIndex === -1) {
            nextItems = [
              ...state.items,
              {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                image: product.thumbnail,
                quantity: safeQuantity,
                availability: product.availability,
                variantId,
                variantLabel,
              },
            ];
          } else {
            nextItems = state.items.map((item, index) => {
              if (index !== existingIndex) {
                return item;
              }

              return {
                ...item,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                image: product.thumbnail,
                availability: product.availability,
                quantity: Math.max(
                  1,
                  Math.min(MAX_ITEM_QUANTITY, item.quantity + safeQuantity),
                ),
              };
            });
          }

          return {
            items: nextItems,
            cartTotal: calculateCartTotal(nextItems),
          };
        }),
      removeItem: (productId, variantId) =>
        set((state) => {
          const nextItems = state.items.filter(
            (item) => !(item.productId === productId && item.variantId === variantId),
          );

          return {
            items: nextItems,
            cartTotal: calculateCartTotal(nextItems),
          };
        }),
      updateQuantity: (productId, quantity, variantId) =>
        set((state) => {
          const safeQuantity = Math.floor(quantity);

          if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
            const nextItems = state.items.filter(
              (item) => !(item.productId === productId && item.variantId === variantId),
            );

            return {
              items: nextItems,
              cartTotal: calculateCartTotal(nextItems),
            };
          }

          const normalizedQuantity = Math.min(MAX_ITEM_QUANTITY, safeQuantity);
          const nextItems = state.items.map((item) => {
            if (item.productId !== productId || item.variantId !== variantId) {
              return item;
            }

            return {
              ...item,
              quantity: normalizedQuantity,
            };
          });

          return {
            items: nextItems,
            cartTotal: calculateCartTotal(nextItems),
          };
        }),
      clearCart: () => ({
        items: [],
        cartTotal: 0,
      }),
    }),
    {
      name: STOREFRONT_CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartTotal: state.cartTotal,
      }),
    },
  ),
);

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function resetStorefrontCart(): void {
  useStorefrontCartStore.setState({ items: [], cartTotal: 0 });

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(STOREFRONT_CART_STORAGE_KEY);

    // Remove stale cart snapshots from the legacy per-store cart context.
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(LEGACY_STORE_CART_STORAGE_PREFIX))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage failures; in-memory state has already been reset.
  }
}
