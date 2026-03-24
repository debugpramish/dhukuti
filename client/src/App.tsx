import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppErrorBoundary from '@/components/common/AppErrorBoundary';
import DashboardLayout from '@/layouts/DashboardLayout';
import StoreLayout from '@/layouts/StoreLayout';
import { getAuthToken } from '@/lib/auth';
import { getStoreSlugFromLocation } from '@/lib/storefront-url';
import ThemeAwareHomePage from '@/pages/thems/ThemeAwareHomePage';

const OverviewPage = lazy(() => import('@/pages/dashboard/Overview'));
const OrdersPage = lazy(() => import('@/pages/dashboard/Orders'));
const ProductsPage = lazy(() => import('@/pages/dashboard/Products'));
const SettingsPage = lazy(() => import('@/pages/dashboard/Settings'));
const CouponsPage = lazy(() => import('@/pages/dashboard/Coupons'));
const CustomersPage = lazy(() => import('@/pages/dashboard/Customers'));
const InventoryPage = lazy(() => import('@/pages/dashboard/Inventory'));
const ReportsPage = lazy(() => import('@/pages/dashboard/Reports'));
const FulfillmentPage = lazy(() => import('@/pages/dashboard/Fulfillment'));
const AbandonedCartsPage = lazy(() => import('@/pages/dashboard/AbandonedCarts'));
const FinancePage = lazy(() => import('@/pages/dashboard/Finance'));
const AnalyticsPage = lazy(() => import('@/pages/dashboard/Analytics'));
const MarketingLandingPage = lazy(() => import('@/pages/marketing/LandingPage'));

const MerchantLoginPage = lazy(() => import('@/pages/dashboard/auth/LoginPage'));
const MerchantSignupPage = lazy(() => import('@/pages/dashboard/auth/SignupPage'));

const ThemeAwareShopPage = lazy(() => import('@/pages/thems/ThemeAwareShopPage'));
const ThemeAwareProductPage = lazy(() => import('@/pages/thems/ThemeAwareProductPage'));
const ThemeAwareCartPage = lazy(() => import('@/pages/thems/ThemeAwareCartPage'));
const ThemeAwareCheckoutPage = lazy(() => import('@/pages/thems/ThemeAwareCheckoutPage'));
const ThemeAwareLoginPage = lazy(() => import('@/pages/thems/ThemeAwareLoginPage'));
const ThemeAwareRegisterPage = lazy(() => import('@/pages/thems/ThemeAwareRegisterPage'));
const ThemeAwareAccountPage = lazy(() => import('@/pages/thems/ThemeAwareAccountPage'));
const ThemeAwareAccountOrdersPage = lazy(() => import('@/pages/thems/ThemeAwareAccountOrdersPage'));
const ThemeAwareOrderConfirmationPage = lazy(() => import('@/pages/thems/ThemeAwareOrderConfirmationPage'));
const ThemeAwareSearchPage = lazy(() => import('@/pages/thems/ThemeAwareSearchPage'));
const ThemeAwareWishlistPage = lazy(() => import('@/pages/thems/ThemeAwareWishlistPage'));
const ThemeAwareCmsPage = lazy(() => import('@/pages/thems/ThemeAwareCmsPage'));
const ThemeAwareContactPage = lazy(() => import('@/pages/thems/ThemeAwareContactPage'));
const ThemeAwareNotFoundPage = lazy(() => import('@/pages/thems/ThemeAwareNotFoundPage'));

function ProtectedDashboardRoute({ children }: { children: ReactNode }) {
  if (!getAuthToken()) {
    return <Navigate to="/dashboard/login" replace />;
  }

  return <>{children}</>;
}

function FallbackLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        Loading page...
      </div>
    </main>
  );
}

function RootEntry() {
  const storeSlug = getStoreSlugFromLocation();
  if (storeSlug) {
    return <StoreLayout />;
  }

  return <MarketingLandingPage />;
}

function LegacyStoreRedirect() {
  const { slug } = useParams();
  const wildcardPath = useParams()['*'] || '';

  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!normalizedSlug) {
    return <Navigate to="/storefront" replace />;
  }

  try {
    window.localStorage.setItem('dhukuti:storefront:slug', normalizedSlug);
  } catch {
    // Ignore storage write errors and continue with route fallback.
  }

  const normalizedPath = wildcardPath.replace(/^\/+/, '').toLowerCase();

  if (!normalizedPath) {
    return <Navigate to="/storefront" replace />;
  }

  if (normalizedPath.startsWith('catalog')) {
    return <Navigate to="/shop" replace />;
  }

  if (normalizedPath.startsWith('account')) {
    return <Navigate to="/account" replace />;
  }

  if (normalizedPath.startsWith('contact')) {
    return <Navigate to="/contact" replace />;
  }

  return <Navigate to="/storefront" replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppErrorBoundary>
          <Suspense fallback={<FallbackLoader />}>
            <Routes>
              <Route index element={<RootEntry />} />

              <Route path="/" element={<StoreLayout />}>
                <Route path="storefront" element={<ThemeAwareHomePage />} />
                <Route path="shop" element={<ThemeAwareShopPage />} />
                <Route path="product/:slug" element={<ThemeAwareProductPage />} />
                <Route path="cart" element={<ThemeAwareCartPage />} />
                <Route path="checkout" element={<ThemeAwareCheckoutPage />} />
                <Route path="login" element={<ThemeAwareLoginPage />} />
                <Route path="register" element={<ThemeAwareRegisterPage />} />
                <Route path="signup" element={<Navigate to="/register" replace />} />
                <Route path="account" element={<ThemeAwareAccountPage />} />
                <Route path="account/orders" element={<ThemeAwareAccountOrdersPage />} />
                <Route path="order-confirmation/:orderId" element={<ThemeAwareOrderConfirmationPage />} />
                <Route path="search" element={<ThemeAwareSearchPage />} />
                <Route path="wishlist" element={<ThemeAwareWishlistPage />} />
                <Route path="contact" element={<ThemeAwareContactPage />} />
                <Route path="page/:slug" element={<ThemeAwareCmsPage />} />
                <Route path="*" element={<ThemeAwareNotFoundPage />} />
              </Route>

              <Route path="/dashboard/login" element={<MerchantLoginPage />} />
              <Route path="/dashboard/register" element={<MerchantSignupPage />} />
              <Route path="/dashboard/signup" element={<Navigate to="/dashboard/register" replace />} />

              <Route
                path="/dashboard"
                element={(
                  <ProtectedDashboardRoute>
                    <DashboardLayout />
                  </ProtectedDashboardRoute>
                )}
              >
                <Route index element={<OverviewPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="coupons" element={<CouponsPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="abandoned-carts" element={<AbandonedCartsPage />} />
                <Route path="fulfillment" element={<FulfillmentPage />} />
                <Route path="inventory" element={<InventoryPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="finance" element={<FinancePage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="/products" element={<Navigate to="/dashboard/products" replace />} />
              <Route path="/orders" element={<Navigate to="/dashboard/orders" replace />} />
              <Route path="/abandoned-carts" element={<Navigate to="/dashboard/abandoned-carts" replace />} />
              <Route path="/fulfillment" element={<Navigate to="/dashboard/fulfillment" replace />} />
              <Route path="/customers" element={<Navigate to="/dashboard/customers" replace />} />
              <Route path="/coupons" element={<Navigate to="/dashboard/coupons" replace />} />
              <Route path="/inventory" element={<Navigate to="/dashboard/inventory" replace />} />
              <Route path="/analytics" element={<Navigate to="/dashboard/analytics" replace />} />
              <Route path="/reports" element={<Navigate to="/dashboard/reports" replace />} />
              <Route path="/finance" element={<Navigate to="/dashboard/finance" replace />} />
              <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
              <Route path="/store/:slug/*" element={<LegacyStoreRedirect />} />
            </Routes>
          </Suspense>
        </AppErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
