import SearchPage from '@/pages/storefront/SearchPage';
import PremiumSearchPage from '@/pages/thems/premium/SearchPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareSearchPage() {
  return <ThemeAwareStorePage classicPage={SearchPage} premiumPage={PremiumSearchPage} />;
}
