import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { StorefrontProduct, WishlistItem } from '@/features/storefront/types';

type StorefrontWishlistState = {
  items: WishlistItem[];
  addToWishlist: (product: StorefrontProduct) => void;
  removeFromWishlist: (productId: string) => void;
};

export const useStorefrontWishlistStore = create<StorefrontWishlistState>()(
  persist(
    (set) => ({
      items: [],
      addToWishlist: (product) =>
        set((state) => {
          if (state.items.some((item) => item.productId === product.id)) {
            return state;
          }

          return {
            items: [
              {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                image: product.thumbnail,
              },
              ...state.items,
            ],
          };
        }),
      removeFromWishlist: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        })),
    }),
    {
      name: 'dhukuti-storefront-wishlist',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
