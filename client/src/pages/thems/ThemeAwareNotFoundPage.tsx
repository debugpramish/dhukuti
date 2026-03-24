import NotFoundPage from '@/pages/storefront/NotFoundPage';
import PremiumNotFoundPage from '@/pages/thems/premium/NotFoundPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareNotFoundPage() {
  return <ThemeAwareStorePage classicPage={NotFoundPage} premiumPage={PremiumNotFoundPage} />;
}
