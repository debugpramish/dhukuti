import { useContext } from 'react';

import { StoreCartContext, type StoreCartContextValue } from '@/contexts/store-cart-core';

export function useStoreCart(): StoreCartContextValue {
  const context = useContext(StoreCartContext);

  if (!context) {
    throw new Error('useStoreCart must be used within a StoreCartProvider');
  }

  return context;
}
