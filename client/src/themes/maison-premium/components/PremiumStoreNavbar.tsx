import { type FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { fetchSearchSuggestions } from '@/features/storefront/api/storefrontApi';
import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { getCartItemCount, useStorefrontCartStore } from '@/stores/storefront-cart-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';
import { useStorefrontWishlistStore } from '@/stores/storefront-wishlist-store';

type PremiumStoreNavbarProps = {
  storeName?: string;
  logoUrl?: string;
};

const navigationLinks = [
  { label: 'Maison', to: '/storefront' },
  { label: 'Collections', to: '/shop' },
  { label: 'Search', to: '/search' },
  { label: 'Contact', to: '/contact' },
  { label: 'Journal', to: '/page/shipping-policy' },
];

export default function PremiumStoreNavbar({ storeName = 'Dhukuti Maison', logoUrl }: PremiumStoreNavbarProps) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchQuery = useDebounce(searchInput, 250);

  const itemCount = useStorefrontCartStore((state) => getCartItemCount(state.items));
  const wishlistCount = useStorefrontWishlistStore((state) => state.items.length);
  const openCartDrawer = useStorefrontUiStore((state) => state.openCartDrawer);

  const { data: suggestions = [] } = useQuery({
    queryKey: storefrontQueryKeys.searchSuggestions(debouncedSearchQuery),
    queryFn: () => fetchSearchSuggestions(debouncedSearchQuery),
    enabled: debouncedSearchQuery.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const topSuggestions = useMemo(() => suggestions.slice(0, 4), [suggestions]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchInput.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
    setMobileMenuOpen(false);
  };

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition-all',
      isActive
        ? 'bg-[#c4a35a] text-[#120d16]'
        : 'text-[#ddd4c4] hover:bg-white/10 hover:text-[#f8f1e5]',
    );

  return (
    <header className="sticky top-0 z-40 border-b border-[#3f3422] bg-[rgba(13,11,16,0.9)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((state) => !state)}
          className="rounded-xl border border-[#4a3c28] bg-[#18131f] p-2 text-[#eee3d0] sm:hidden"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <Link to="/storefront" className="group flex shrink-0 items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={`${storeName} logo`} className="h-9 w-9 rounded-xl object-cover" loading="lazy" />
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#5f4f35] bg-[#1a1620] text-[10px] font-black tracking-[0.18em] text-[#f0dfbf]">
              MP
            </span>
          )}
          <span className="font-['Cormorant_Garamond'] text-2xl font-semibold tracking-[0.08em] text-[#f8f1e5] transition group-hover:text-[#d8be8c]">
            {storeName}
          </span>
        </Link>

        <nav className="hidden items-center gap-2 sm:flex">
          {navigationLinks.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClassName}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative ml-auto hidden min-w-0 flex-1 sm:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9f937f]" />
            <input
              type="search"
              placeholder="Search maison catalogue"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-11 w-full rounded-full border border-[#4e412f] bg-[#17121d] pl-10 pr-3 text-sm text-[#f6eee2] outline-none transition focus:border-[#b89247]"
              aria-label="Search products"
            />
          </form>

          {topSuggestions.length > 0 && debouncedSearchQuery.trim().length >= 2 ? (
            <div className="absolute left-0 right-0 top-12 rounded-2xl border border-[#4a3d2c] bg-[#1a1520] p-2 shadow-2xl">
              {topSuggestions.map((suggestion) => (
                <Link
                  key={suggestion.id}
                  to={`/product/${suggestion.slug}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#dccfb9] transition hover:bg-white/10"
                >
                  <img src={suggestion.thumbnail} alt={suggestion.title} loading="lazy" className="h-9 w-9 rounded-lg object-cover" />
                  <span className="line-clamp-1">{suggestion.title}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/wishlist"
            className="relative rounded-full border border-[#4a3d2c] bg-[#17121d] p-2 text-[#e6d8c1] transition hover:bg-white/10"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c4a35a] px-1 text-[10px] text-[#120d16]">
                {wishlistCount > 99 ? '99+' : wishlistCount}
              </span>
            ) : null}
          </Link>

          <Link
            to="/account"
            className="rounded-full border border-[#4a3d2c] bg-[#17121d] p-2 text-[#e6d8c1] transition hover:bg-white/10"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={openCartDrawer}
            className="relative rounded-full border border-[#4a3d2c] bg-[#17121d] p-2 text-[#e6d8c1] transition hover:bg-white/10"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c4a35a] px-1 text-[10px] text-[#120d16]">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-[#3f3422] bg-[#130f1a] px-4 py-4 backdrop-blur sm:hidden">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9f937f]" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-10 w-full rounded-full border border-[#4e412f] bg-[#17121d] pl-9 pr-2 text-sm text-[#f6eee2]"
              placeholder="Search"
            />
          </form>

          <nav className="mt-3 flex flex-col gap-2">
            {navigationLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn('rounded-xl px-3 py-2 text-sm uppercase tracking-[0.15em]', isActive ? 'bg-[#c4a35a] text-[#120d16]' : 'text-[#ddd4c4]')
                }
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
