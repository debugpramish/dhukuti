import CartPage from '@/pages/storefront/CartPage';
import PremiumCartPage from '@/pages/thems/premium/CartPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareCartPage() {
  return <ThemeAwareStorePage classicPage={CartPage} premiumPage={PremiumCartPage} />;
}
