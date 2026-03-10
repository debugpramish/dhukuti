import { Link } from 'react-router-dom';

type StoreFooterProps = {
  storeName?: string;
  phone?: string;
  address?: string;
};

const footerLinks = [
  { label: 'Contact', to: '/contact' },
  { label: 'Shipping Policy', to: '/page/shipping-policy' },
  { label: 'Return Policy', to: '/page/return-policy' },
  { label: 'Privacy Policy', to: '/page/privacy-policy' },
  { label: 'Wishlist', to: '/wishlist' },
];

export default function StoreFooter({ storeName = 'Dhukuti Store', phone, address }: StoreFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-14 pb-6">
      <div className="mx-auto w-full max-w-[84rem] px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-slate-200/50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-10 text-slate-200 shadow-[0_30px_70px_-38px_rgba(2,6,23,0.95)] sm:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="storefront-heading text-2xl font-semibold text-white">{storeName}</p>
              <p className="max-w-sm text-sm text-slate-300">
                Crafted shopping experience with curated collections, secure checkout, and responsive support.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-2 text-sm">
              {footerLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="space-y-1 text-sm text-slate-300 lg:text-right">
              {address ? <p>{address}</p> : null}
              {phone ? <p>{phone}</p> : null}
              <p className="text-slate-400">&copy; {year} {storeName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
