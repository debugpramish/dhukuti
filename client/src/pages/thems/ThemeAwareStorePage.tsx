import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';

import { fetchStorefrontStore } from '@/features/storefront/api/storefrontApi';
import { resolveStorefrontTheme } from '@/lib/storefront-theme';
import '@/pages/thems/premium/PremiumPages.css';

type ThemeAwareStorePageProps = {
  classicPage: ComponentType;
  premiumPage: ComponentType;
};

export default function ThemeAwareStorePage({ classicPage: ClassicPage, premiumPage: PremiumPage }: ThemeAwareStorePageProps) {
  const { data: store } = useQuery({
    queryKey: ['storefront', 'store-info'] as const,
    queryFn: fetchStorefrontStore,
    retry: 0,
  });

  if (!store) {
    return <ClassicPage />;
  }

  const theme = resolveStorefrontTheme(store);
  if (theme === 'maison_premium') {
    return <PremiumPage />;
  }

  return <ClassicPage />;
}
