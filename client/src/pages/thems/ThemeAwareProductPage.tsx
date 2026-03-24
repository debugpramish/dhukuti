import ProductPage from '@/pages/storefront/ProductPage';
import PremiumProductPage from '@/pages/thems/premium/ProductPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareProductPage() {
  return <ThemeAwareStorePage classicPage={ProductPage} premiumPage={PremiumProductPage} />;
}
