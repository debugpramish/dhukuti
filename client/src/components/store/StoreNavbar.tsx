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

type StoreNavbarProps = {
  storeName?: string;
  slug?: string;
  logoUrl?: string;
};

const navigationLinks = [
  { label: 'Home', to: '/storefront' },
  { label: 'Shop', to: '/shop' },
  { label: 'Search', to: '/search' },
  { label: 'Contact', to: '/contact' },
  { label: 'Pages', to: '/page/shipping-policy' },
];

export default function StoreNavbar({ storeName = 'Dhukuti Store', logoUrl }: StoreNavbarProps) {
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
      'rounded-full px-3 py-1.5 text-sm font-semibold transition-all',
      isActive
        ? 'bg-slate-900 text-white shadow-[0_8px_20px_-12px_rgba(15,23,42,0.9)]'
        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
    );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-[rgba(248,250,252,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-[84rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((state) => !state)}
          className="rounded-xl border border-slate-200/90 bg-white/85 p-2 text-slate-700 shadow-sm sm:hidden"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        <Link to="/storefront" className="group flex shrink-0 items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${storeName} logo`}
              className="h-9 w-9 rounded-xl object-cover shadow-sm"
              loading="lazy"
            />
          ) : (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-xs font-black text-slate-900 shadow-sm">
              DS
            </span>
          )}
          <span className="storefront-heading text-xl font-semibold text-slate-900 transition group-hover:text-slate-700">
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search products"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-11 w-full rounded-full border border-white/80 bg-white/90 pl-10 pr-3 text-sm shadow-[0_18px_28px_-22px_rgba(15,23,42,0.9)] outline-none transition focus:border-slate-300 focus:bg-white"
              aria-label="Search products"
            />
          </form>

          {topSuggestions.length > 0 && debouncedSearchQuery.trim().length >= 2 ? (
            <div className="storefront-surface absolute left-0 right-0 top-12 rounded-2xl p-2">
              {topSuggestions.map((suggestion) => (
                <Link
                  key={suggestion.id}
                  to={`/product/${suggestion.slug}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100/70"
                >
                  <img
                    src={suggestion.thumbnail}
                    alt={suggestion.title}
                    loading="lazy"
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                  <span className="line-clamp-1">{suggestion.title}</span>
                </Link>
              ))}
              <Link
                to={`/search?q=${encodeURIComponent(debouncedSearchQuery)}`}
                className="mt-1 block rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100/70"
              >
                View all results
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/wishlist"
            className="relative rounded-full border border-white/80 bg-white/85 p-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] text-white">
                {wishlistCount > 99 ? '99+' : wishlistCount}
              </span>
            ) : null}
          </Link>

          <Link
            to="/account"
            className="rounded-full border border-white/80 bg-white/85 p-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={openCartDrawer}
            className="relative rounded-full border border-white/80 bg-white/85 p-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-slate-200/70 bg-white/90 px-4 py-4 backdrop-blur sm:hidden">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-10 w-full rounded-full border border-slate-200 bg-white pl-9 pr-2 text-sm"
              placeholder="Search"
            />
          </form>

          <nav className="mt-3 flex flex-col gap-2">
            {navigationLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2 text-sm',
                    isActive ? 'bg-slate-900 font-semibold text-white' : 'text-slate-600',
                  )
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
