import { Link } from 'react-router-dom';

type PremiumStoreFooterProps = {
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

export default function PremiumStoreFooter({ storeName = 'Dhukuti Maison', phone, address }: PremiumStoreFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 pb-8">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-[#4a3d2c] bg-gradient-to-br from-[#0f0b14] via-[#1b1622] to-[#221a2c] px-6 py-10 text-[#e8dcc6] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95)] sm:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="font-['Cormorant_Garamond'] text-3xl font-semibold tracking-[0.07em] text-[#f8f1e5]">{storeName}</p>
              <p className="max-w-sm text-sm text-[#c8b99c]">
                Curated luxury storefront for merchants who want premium storytelling and conversion-focused commerce.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-2 text-sm">
              {footerLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-lg px-2 py-1 text-[#cdbd9f] transition hover:bg-white/10 hover:text-[#f5ead6]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="space-y-1 text-sm text-[#cdbd9f] lg:text-right">
              {address ? <p>{address}</p> : null}
              {phone ? <p>{phone}</p> : null}
              <p className="text-[#a89778]">&copy; {year} {storeName}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
