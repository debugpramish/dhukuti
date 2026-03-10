function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildProductPlaceholderImage(title: string): string {
  const safeTitle = escapeSvgText(title.trim().slice(0, 32) || 'Product');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#334155" font-size="24" font-family="Arial, sans-serif">${safeTitle}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function resolveApiOrigin(apiBaseUrl: string): string {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return '';
  }
}

function normalizeUploadPath(pathname: string): string {
  if (pathname.startsWith('/api/v1/uploads/')) {
    return pathname.replace('/api/v1/uploads/', '/uploads/');
  }

  if (pathname.startsWith('/api/uploads/')) {
    return pathname.replace('/api/uploads/', '/uploads/');
  }

  return pathname;
}

export function normalizeAssetUrl(assetUrl: string | undefined | null, apiBaseUrl: string): string | undefined {
  if (!assetUrl) {
    return undefined;
  }

  const trimmedUrl = assetUrl.trim();
  if (!trimmedUrl) {
    return undefined;
  }

  if (trimmedUrl.startsWith('data:image/')) {
    return trimmedUrl;
  }

  if (/^https?:\/\//i.test(trimmedUrl)) {
    try {
      const parsedUrl = new URL(trimmedUrl);
      const normalizedPathname = normalizeUploadPath(parsedUrl.pathname);
      return `${parsedUrl.origin}${normalizedPathname}${parsedUrl.search}${parsedUrl.hash}`;
    } catch {
      return trimmedUrl;
    }
  }

  const apiOrigin = resolveApiOrigin(apiBaseUrl);
  if (!apiOrigin) {
    return trimmedUrl;
  }

  const normalizedPath = normalizeUploadPath(trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`);
  return `${apiOrigin}${normalizedPath}`;
}

export function normalizeProductImageUrl(imageUrl: string, title: string, apiBaseUrl: string): string {
  const normalizedUrl = normalizeAssetUrl(imageUrl, apiBaseUrl);
  if (!normalizedUrl) {
    return buildProductPlaceholderImage(title);
  }

  return normalizedUrl;
}
