import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { StorefrontProduct } from '@/features/storefront/types';

type RecentlyViewedProduct = {
  productId: string;
  slug: string;
  title: string;
  image: string;
  price: number;
};

type RecentlyViewedState = {
  items: RecentlyViewedProduct[];
  trackProduct: (product: StorefrontProduct) => void;
  clearRecentlyViewed: () => void;
};

const MAX_ITEMS = 12;

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      trackProduct: (product) =>
        set((state) => {
          const nextItem: RecentlyViewedProduct = {
            productId: product.id,
            slug: product.slug,
            title: product.title,
            image: product.thumbnail,
            price: product.price,
          };

          const filtered = state.items.filter((item) => item.productId !== product.id);

          return {
            items: [nextItem, ...filtered].slice(0, MAX_ITEMS),
          };
        }),
      clearRecentlyViewed: () => ({ items: [] }),
    }),
    {
      name: 'dhukuti-storefront-recently-viewed',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
