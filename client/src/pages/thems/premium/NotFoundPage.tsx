import { Link } from 'react-router-dom';

import { useSeo } from '@/hooks/use-seo';

export default function NotFoundPage() {
  useSeo({
    title: 'Not Found',
    description: 'The page you requested does not exist.',
  });

  return (
    <div className="premium-route premium-route-not-found">
      <div className="storefront-panel p-10 text-center">
        <h1 className="storefront-heading text-4xl font-semibold text-slate-900">This room does not exist</h1>
        <p className="mt-2 text-sm text-slate-600">The page you requested is not available in this collection.</p>
        <Link
          to="/storefront"
          className="mt-4 inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Return to Maison Home
        </Link>
      </div>
    </div>
  );
}
