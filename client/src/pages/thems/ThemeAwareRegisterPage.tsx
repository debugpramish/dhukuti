import RegisterPage from '@/pages/storefront/RegisterPage';
import PremiumRegisterPage from '@/pages/thems/premium/RegisterPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareRegisterPage() {
  return <ThemeAwareStorePage classicPage={RegisterPage} premiumPage={PremiumRegisterPage} />;
}
