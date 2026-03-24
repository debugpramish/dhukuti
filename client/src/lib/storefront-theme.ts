import { getAuthToken } from '@/lib/auth';
import type { StorefrontStore } from '@/features/storefront/types';

export type StorefrontTheme = 'classic' | 'maison_premium';

function normalizeTheme(value: string): StorefrontTheme {
  return value === 'maison_premium' ? 'maison_premium' : 'classic';
}

function getPreviewStorageKey(slug: string): string {
  return `dhukuti:storefront:theme-preview:${slug}`;
}

export function setThemePreviewOverride(slug: string, theme: StorefrontTheme) {
  if (typeof window === 'undefined' || !slug) {
    return;
  }

  try {
    if (theme === 'classic') {
      window.localStorage.removeItem(getPreviewStorageKey(slug));
      return;
    }

    window.localStorage.setItem(getPreviewStorageKey(slug), theme);
  } catch {
    // Ignore storage failures in private/incognito sessions.
  }
}

function readThemePreviewFromQuery(): StorefrontTheme | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const previewTheme = normalizeTheme(String(params.get('themePreview') || ''));
  if (previewTheme !== 'maison_premium') {
    return null;
  }

  return previewTheme;
}

function readThemePreviewFromStorage(slug: string): StorefrontTheme | null {
  if (typeof window === 'undefined' || !slug) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(getPreviewStorageKey(slug)) || '';
    const normalized = normalizeTheme(stored);
    return normalized === 'maison_premium' ? normalized : null;
  } catch {
    return null;
  }
}

export function resolveStorefrontTheme(store: StorefrontStore): StorefrontTheme {
  const activeTheme = normalizeTheme(store.activeTheme || 'classic');

  // Query-based preview is useful for direct preview links from dashboard.
  const queryPreview = readThemePreviewFromQuery();
  if (queryPreview) {
    return queryPreview;
  }

  // Preview mode is merchant-only. Public visitors always see activeTheme.
  if (!getAuthToken()) {
    return activeTheme;
  }

  const storedPreview = readThemePreviewFromStorage(store.slug);
  if (storedPreview) {
    return storedPreview;
  }

  return activeTheme;
}
