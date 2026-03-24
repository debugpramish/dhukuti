import ContactPage from '@/pages/storefront/ContactPage';
import PremiumContactPage from '@/pages/thems/premium/ContactPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareContactPage() {
  return <ThemeAwareStorePage classicPage={ContactPage} premiumPage={PremiumContactPage} />;
}
