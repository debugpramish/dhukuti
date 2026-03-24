import WishlistPage from '@/pages/storefront/WishlistPage';
import PremiumWishlistPage from '@/pages/thems/premium/WishlistPage';
import ThemeAwareStorePage from '@/pages/thems/ThemeAwareStorePage';

export default function ThemeAwareWishlistPage() {
  return <ThemeAwareStorePage classicPage={WishlistPage} premiumPage={PremiumWishlistPage} />;
}
