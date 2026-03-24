import CheckoutPage from '@/pages/storefront/CheckoutPage';
import PremiumCheckoutPage from '@/pages/thems/premium/CheckoutPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareCheckoutPage() {
  return <ThemeAwareStorePage classicPage={CheckoutPage} premiumPage={PremiumCheckoutPage} />;
}
