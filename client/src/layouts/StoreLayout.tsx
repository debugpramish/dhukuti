import { useQuery } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';

import StoreCartDrawer from '@/components/store/StoreCartDrawer';
import StoreFooter from '@/components/store/StoreFooter';
import StoreNavbar from '@/components/store/StoreNavbar';
import StoreToaster from '@/components/common/StoreToaster';
import { fetchStorefrontStore } from '@/features/storefront/api/storefrontApi';

const storefrontName = import.meta.env.VITE_STOREFRONT_NAME || 'Dhukuti Store';

export default function StoreLayout() {
  const { data: store } = useQuery({
    queryKey: ['storefront', 'store-info'],
    queryFn: fetchStorefrontStore,
    retry: 0,
  });

  const resolvedStoreName = store?.name || storefrontName;

  return (
    <div className="storefront-shell">
      <div className="storefront-orb storefront-orb-one" aria-hidden />
      <div className="storefront-orb storefront-orb-two" aria-hidden />
      <div className="storefront-orb storefront-orb-three" aria-hidden />
      <StoreNavbar storeName={resolvedStoreName} logoUrl={store?.logoUrl} />
      <main className="storefront-main sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <StoreFooter
        storeName={resolvedStoreName}
        address={store?.address}
        phone={store?.phone}
      />
      <StoreCartDrawer storeName={resolvedStoreName} />
      <StoreToaster />
    </div>
  );
}
