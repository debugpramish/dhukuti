import { useQuery } from '@tanstack/react-query';
import { Link, useOutlet } from 'react-router-dom';

import StoreCartDrawer from '@/components/store/StoreCartDrawer';
import StoreToaster from '@/components/common/StoreToaster';
import { fetchStorefrontStore } from '@/features/storefront/api/storefrontApi';
import { resolveStorefrontTheme } from '@/lib/storefront-theme';
import ThemeAwareHomePage from '@/themes/ThemeAwareHomePage';
import { ThemeAwareStoreFooter, ThemeAwareStoreNavbar } from '@/themes/ThemeAwareStoreChrome';
import '@/themes/maison-premium/PremiumStorefront.css';

const storefrontName = import.meta.env.VITE_STOREFRONT_NAME || 'Dhukuti Store';

export default function StoreLayout() {
  const outlet = useOutlet();

  const {
    data: store,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['storefront', 'store-info'],
    queryFn: fetchStorefrontStore,
    retry: 0,
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading store...</p>
      </main>
    );
  }

  if (isError || !store) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Store not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error instanceof Error ? error.message : 'This storefront URL is no longer active.'}
          </p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Go to homepage
          </Link>
        </div>
      </main>
    );
  }

  const resolvedStoreName = store.name || storefrontName;
  const storefrontTheme = resolveStorefrontTheme(store);
  const isPremiumTheme = storefrontTheme === 'maison_premium';

  return (
    <div className={`storefront-shell ${isPremiumTheme ? 'storefront-shell-premium' : ''}`}>
      <div className="storefront-orb storefront-orb-one" aria-hidden />
      <div className="storefront-orb storefront-orb-two" aria-hidden />
      <div className="storefront-orb storefront-orb-three" aria-hidden />
      <ThemeAwareStoreNavbar store={store} storeName={resolvedStoreName} />
      <main className="storefront-main sm:px-6 lg:px-8">
        {outlet ?? <ThemeAwareHomePage />}
      </main>
      <ThemeAwareStoreFooter store={store} storeName={resolvedStoreName} />
      <StoreCartDrawer storeName={resolvedStoreName} />
      <StoreToaster />
    </div>
  );
}
