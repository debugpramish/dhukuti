import { useEffect } from 'react';

type SeoInput = {
  title: string;
  description?: string;
};

const DEFAULT_TITLE = 'Dhukuti Storefront';
const DEFAULT_DESCRIPTION = 'Browse products, manage your cart, and place orders easily.';

function upsertMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.append(tag);
  }

  tag.setAttribute('content', content);
}

export function useSeo({ title, description }: SeoInput) {
  useEffect(() => {
    document.title = title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;
    upsertMeta('description', description || DEFAULT_DESCRIPTION);
  }, [description, title]);
}
