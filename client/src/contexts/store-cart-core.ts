import { createContext } from 'react';

import type { Product } from '@/services/api/types';

export type StoreCartItem = {
  productId: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  quantity: number;
};

export type StoreCartContextValue = {
  items: StoreCartItem[];
  totalItems: number;
  subtotal: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
};

export const StoreCartContext = createContext<StoreCartContextValue | undefined>(undefined);
