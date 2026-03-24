import StoreFooter from '@/components/store/StoreFooter';
import StoreNavbar from '@/components/store/StoreNavbar';
import { resolveStorefrontTheme } from '@/lib/storefront-theme';
import type { StorefrontStore } from '@/features/storefront/types';
import PremiumStoreFooter from '@/themes/maison-premium/components/PremiumStoreFooter';
import PremiumStoreNavbar from '@/themes/maison-premium/components/PremiumStoreNavbar';

type ThemeAwareStoreNavbarProps = {
  store: StorefrontStore;
  storeName: string;
};

type ThemeAwareStoreFooterProps = {
  store: StorefrontStore;
  storeName: string;
};

export function ThemeAwareStoreNavbar({ store, storeName }: ThemeAwareStoreNavbarProps) {
  const theme = resolveStorefrontTheme(store);

  if (theme === 'maison_premium') {
    return <PremiumStoreNavbar storeName={storeName} logoUrl={store.logoUrl} />;
  }

  return <StoreNavbar storeName={storeName} logoUrl={store.logoUrl} />;
}

export function ThemeAwareStoreFooter({ store, storeName }: ThemeAwareStoreFooterProps) {
  const theme = resolveStorefrontTheme(store);

  if (theme === 'maison_premium') {
    return <PremiumStoreFooter storeName={storeName} address={store.address} phone={store.phone} />;
  }

  return <StoreFooter storeName={storeName} address={store.address} phone={store.phone} />;
}
