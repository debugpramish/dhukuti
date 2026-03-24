import LoginPage from '@/pages/storefront/LoginPage';
import PremiumLoginPage from '@/pages/thems/premium/LoginPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareLoginPage() {
  return <ThemeAwareStorePage classicPage={LoginPage} premiumPage={PremiumLoginPage} />;
}
