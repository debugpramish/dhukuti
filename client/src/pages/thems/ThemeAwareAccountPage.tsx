import AccountPage from '@/pages/storefront/AccountPage';
import PremiumAccountPage from '@/pages/thems/premium/AccountPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareAccountPage() {
  return <ThemeAwareStorePage classicPage={AccountPage} premiumPage={PremiumAccountPage} />;
}
