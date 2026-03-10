import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppErrorBoundary from '@/components/common/AppErrorBoundary';
import DashboardLayout from '@/layouts/DashboardLayout';
import StoreLayout from '@/layouts/StoreLayout';
import { getAuthToken } from '@/lib/auth';

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

const MerchantLoginPage = lazy(() => import('@/pages/login'));
const MerchantSignupPage = lazy(() => import('@/pages/signup'));

const HomePage = lazy(() => import('@/pages/storefront/HomePage'));
const ShopPage = lazy(() => import('@/pages/storefront/ShopPage'));
const ProductPage = lazy(() => import('@/pages/storefront/ProductPage'));
const CartPage = lazy(() => import('@/pages/storefront/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/storefront/CheckoutPage'));
const CustomerLoginPage = lazy(() => import('@/pages/storefront/LoginPage'));
const CustomerRegisterPage = lazy(() => import('@/pages/storefront/RegisterPage'));
const AccountPage = lazy(() => import('@/pages/storefront/AccountPage'));
const AccountOrdersPage = lazy(() => import('@/pages/storefront/AccountOrdersPage'));
const OrderConfirmationPage = lazy(() => import('@/pages/storefront/OrderConfirmationPage'));
const SearchPage = lazy(() => import('@/pages/storefront/SearchPage'));
const WishlistPage = lazy(() => import('@/pages/storefront/WishlistPage'));
const CmsPage = lazy(() => import('@/pages/storefront/CmsPage'));
const ContactPage = lazy(() => import('@/pages/storefront/ContactPage'));
const NotFoundPage = lazy(() => import('@/pages/storefront/NotFoundPage'));

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

function RootRedirect() {
  const location = useLocation();

  try {
    const params = new URLSearchParams(location.search);
    const storeSlug = params.get('store');
    if (storeSlug) {
      return <Navigate to={`/storefront${location.search || ''}`} replace />;
    }
  } catch {
    // Ignore malformed search params and fall through to the default redirect.
  }

  return <Navigate to="/dashboard" replace />;
}

function LegacyStoreRedirect() {
  const { slug } = useParams();
  const wildcardPath = useParams()['*'] || '';
  const location = useLocation();

  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!normalizedSlug) {
    return <Navigate to="/storefront" replace />;
  }

  const nextSearch = new URLSearchParams(location.search);
  nextSearch.set('store', normalizedSlug);
  const searchSuffix = nextSearch.toString() ? `?${nextSearch.toString()}` : '';
  const normalizedPath = wildcardPath.replace(/^\/+/, '').toLowerCase();

  if (!normalizedPath) {
    return <Navigate to={`/storefront${searchSuffix}`} replace />;
  }

  if (normalizedPath.startsWith('catalog')) {
    return <Navigate to={`/shop${searchSuffix}`} replace />;
  }

  if (normalizedPath.startsWith('account')) {
    return <Navigate to={`/account${searchSuffix}`} replace />;
  }

  if (normalizedPath.startsWith('contact')) {
    return <Navigate to={`/contact${searchSuffix}`} replace />;
  }

  return <Navigate to={`/storefront${searchSuffix}`} replace />;
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
              <Route index element={<RootRedirect />} />

              <Route path="/" element={<StoreLayout />}>
                <Route path="storefront" element={<HomePage />} />
                <Route path="shop" element={<ShopPage />} />
                <Route path="product/:slug" element={<ProductPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="login" element={<CustomerLoginPage />} />
                <Route path="register" element={<CustomerRegisterPage />} />
                <Route path="signup" element={<Navigate to="/register" replace />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="account/orders" element={<AccountOrdersPage />} />
                <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="wishlist" element={<WishlistPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="page/:slug" element={<CmsPage />} />
                <Route path="*" element={<NotFoundPage />} />
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
