import HomePage from '@/pages/storefront/HomePage';
import PremiumHomePage from '@/pages/thems/premium/HomePage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareHomePage() {
  return <ThemeAwareStorePage classicPage={HomePage} premiumPage={PremiumHomePage} />;
}
