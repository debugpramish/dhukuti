import { useQuery } from '@tanstack/react-query';
import { Outlet, useParams } from 'react-router-dom';

import StoreCartDrawer from '@/components/store/StoreCartDrawer';
import StoreFooter from '@/components/store/StoreFooter';
import StoreNavbar from '@/components/store/StoreNavbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StoreCartProvider } from '@/contexts/store-cart-context';
import { getPublicStore } from '@/services/api/publicStoreApi';
import type { PublicStore } from '@/services/api/types';

export type PublicStoreLayoutContext = {
  slug: string;
  store: PublicStore;
};

export default function PublicStoreLayout() {
  const slug = String(useParams().slug || '').trim().toLowerCase();

  const { data: store, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['public-store', slug],
    queryFn: () => getPublicStore(slug),
    enabled: slug.length > 0,
    retry: 1,
  });

  if (!slug) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Invalid store link</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This storefront URL is missing a valid store slug.
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading storefront...</CardContent>
        </Card>
      </main>
    );
  }

  if (isError || !store) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Unable to load storefront</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-destructive">{error instanceof Error ? error.message : 'Request failed'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <StoreCartProvider key={slug} slug={slug}>
      <div className="min-h-screen bg-slate-50">
        <StoreNavbar storeName={store.name} slug={slug} logoUrl={store.logoUrl} />

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <Outlet context={{ slug, store } satisfies PublicStoreLayoutContext} />
        </main>

        <StoreFooter storeName={store.name} phone={store.phone} address={store.address} />
      </div>
      <StoreCartDrawer slug={slug} storeName={store.name} />
    </StoreCartProvider>
  );
}
