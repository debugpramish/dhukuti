import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { storefrontQueryKeys } from '@/features/storefront/api/queryKeys';
import { fetchPageBySlug } from '@/features/storefront/api/storefrontApi';
import { useSeo } from '@/hooks/use-seo';

function splitBodyToParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function CmsPage() {
  const slug = String(useParams().slug || '').trim();

  const pageQuery = useQuery({
    queryKey: storefrontQueryKeys.page(slug),
    queryFn: () => fetchPageBySlug(slug),
    enabled: slug.length > 0,
  });

  useSeo({
    title: pageQuery.data?.seoTitle || pageQuery.data?.title || 'Page',
    description: pageQuery.data?.seoDescription || 'Store information page.',
  });

  if (!slug) {
    return <div className="storefront-panel p-5 text-sm text-slate-600">Invalid page.</div>;
  }

  if (pageQuery.isLoading) {
    return <div className="storefront-panel p-5 text-sm text-slate-600">Loading page...</div>;
  }

  if (pageQuery.isError || !pageQuery.data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">Page not found.</div>;
  }

  return (
    <article className="storefront-panel mx-auto w-full max-w-3xl p-6 sm:p-8">
      <h1 className="storefront-heading text-4xl font-semibold text-slate-900">{pageQuery.data.title}</h1>

      <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700">
        {splitBodyToParagraphs(pageQuery.data.body).map((paragraph, index) => (
          <p key={`${pageQuery.data.slug}-${String(index)}`}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
