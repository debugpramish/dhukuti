import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Product } from '@/services/api/types';
import { StoreCartContext, type StoreCartContextValue, type StoreCartItem } from './store-cart-core';

const CART_STORAGE_PREFIX = 'dhukuti:store-cart';
const MAX_ITEM_QUANTITY = 99;

function toStorageKey(slug: string): string {
  return `${CART_STORAGE_PREFIX}:${slug}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeCartItem(value: unknown): StoreCartItem | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const productId = typeof value.productId === 'string' ? value.productId.trim() : '';
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const price = typeof value.price === 'number' ? value.price : Number(value.price);
  const originalPrice =
    typeof value.originalPrice === 'number' ? value.originalPrice : Number(value.originalPrice);
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl.trim() : '';
  const quantity = typeof value.quantity === 'number' ? value.quantity : Number(value.quantity);

  if (!productId || !title || !imageUrl || !Number.isFinite(price) || !Number.isFinite(quantity)) {
    return null;
  }

  const normalizedQuantity = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(quantity)));

  return {
    productId,
    title,
    price: Math.max(0, price),
    originalPrice: Number.isFinite(originalPrice) ? Math.max(0, originalPrice) : undefined,
    imageUrl,
    quantity: normalizedQuantity,
  };
}

function readCartItems(slug: string): StoreCartItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(toStorageKey(slug));
    if (!rawValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((item) => sanitizeCartItem(item))
      .filter((item): item is StoreCartItem => item !== null);
  } catch {
    return [];
  }
}

type StoreCartProviderProps = {
  slug: string;
  children: ReactNode;
};

export function StoreCartProvider({ slug, children }: StoreCartProviderProps) {
  const [items, setItems] = useState<StoreCartItem[]>(() => readCartItems(slug));
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(toStorageKey(slug), JSON.stringify(items));
    } catch {
      // Ignore storage failures; cart still works in-memory.
    }
  }, [slug, items]);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  const toggleCart = useCallback(() => {
    setIsCartOpen((current) => !current);
  }, []);

  const addToCart = useCallback((product: Product) => {
    setItems((currentItems) => {
      const existingItemIndex = currentItems.findIndex((item) => item.productId === product.id);

      if (existingItemIndex === -1) {
        return [
          ...currentItems,
          {
            productId: product.id,
            title: product.title,
            price: Math.max(0, product.discountedPrice),
            originalPrice: Math.max(0, product.price),
            imageUrl: product.imageUrl,
            quantity: 1,
          },
        ];
      }

      return currentItems.map((item, index) => {
        if (index !== existingItemIndex) {
          return item;
        }

        return {
          ...item,
          price: Math.max(0, product.discountedPrice),
          originalPrice: Math.max(0, product.price),
          quantity: Math.min(MAX_ITEM_QUANTITY, item.quantity + 1),
        };
      });
    });

    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 0;

    if (safeQuantity <= 0) {
      setItems((currentItems) => currentItems.filter((item) => item.productId !== productId));
      return;
    }

    const clampedQuantity = Math.min(MAX_ITEM_QUANTITY, safeQuantity);
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: clampedQuantity,
            }
          : item,
      ),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getItemQuantity = useCallback(
    (productId: string) => items.find((item) => item.productId === productId)?.quantity ?? 0,
    [items],
  );

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.quantity, 0), [items]);

  const value = useMemo<StoreCartContextValue>(
    () => ({
      items,
      totalItems,
      subtotal,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getItemQuantity,
    }),
    [
      items,
      totalItems,
      subtotal,
      isCartOpen,
      openCart,
      closeCart,
      toggleCart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getItemQuantity,
    ],
  );

  return <StoreCartContext.Provider value={value}>{children}</StoreCartContext.Provider>;
}
