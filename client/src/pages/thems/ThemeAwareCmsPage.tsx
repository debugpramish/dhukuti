import CmsPage from '@/pages/storefront/CmsPage';
import PremiumCmsPage from '@/pages/thems/premium/CmsPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareCmsPage() {
  return <ThemeAwareStorePage classicPage={CmsPage} premiumPage={PremiumCmsPage} />;
}
