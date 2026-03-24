import ShopPage from '@/pages/storefront/ShopPage';
import PremiumShopPage from '@/pages/thems/premium/ShopPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareShopPage() {
  return <ThemeAwareStorePage classicPage={ShopPage} premiumPage={PremiumShopPage} />;
}
