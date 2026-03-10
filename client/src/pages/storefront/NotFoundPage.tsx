import { Link } from 'react-router-dom';

import { useSeo } from '@/hooks/use-seo';

export default function NotFoundPage() {
  useSeo({
    title: 'Not Found',
    description: 'The page you requested does not exist.',
  });

  return (
    <div className="storefront-panel p-10 text-center">
      <h1 className="storefront-heading text-4xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you are looking for does not exist.</p>
      <Link
        to="/storefront"
        className="mt-4 inline-flex h-10 items-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Go to home
      </Link>
    </div>
  );
}
