import OrderConfirmationPage from '@/pages/storefront/OrderConfirmationPage';
import PremiumOrderConfirmationPage from '@/pages/thems/premium/OrderConfirmationPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareOrderConfirmationPage() {
  return <ThemeAwareStorePage classicPage={OrderConfirmationPage} premiumPage={PremiumOrderConfirmationPage} />;
}
