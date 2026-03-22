const ENV_STOREFRONT_ROOT_DOMAIN = String(import.meta.env.VITE_STOREFRONT_ROOT_DOMAIN || '')
    .trim()
    .toLowerCase();
const ENV_STOREFRONT_URL_MODE = String(import.meta.env.VITE_STOREFRONT_URL_MODE || 'auto')
    .trim()
    .toLowerCase();

const STORE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function normalizeSlug(value: string): string {
    return value.trim().toLowerCase();
}

function isValidStoreSlug(value: string): boolean {
    return STORE_SLUG_PATTERN.test(value);
}

function resolveRootDomain(hostname: string): string {
    const normalizedHost = hostname.trim().toLowerCase();
    if (!normalizedHost) {
        return '';
    }

    if (ENV_STOREFRONT_ROOT_DOMAIN) {
        return ENV_STOREFRONT_ROOT_DOMAIN;
    }

    if (normalizedHost === 'localhost' || normalizedHost.endsWith('.localhost')) {
        return 'localhost';
    }

    if (normalizedHost.endsWith('.vercel.app')) {
        const hostParts = normalizedHost.split('.');
        if (hostParts.length > 3) {
            return hostParts.slice(1).join('.');
        }

        return normalizedHost;
    }

    return normalizedHost;
}

function shouldUseQueryStoreParam(locationLike: Location): boolean {
    if (ENV_STOREFRONT_URL_MODE === 'query') {
        return true;
    }

    if (ENV_STOREFRONT_URL_MODE === 'subdomain') {
        return false;
    }

    const normalizedHost = locationLike.hostname.trim().toLowerCase();
    const rootDomain = resolveRootDomain(normalizedHost);

    // Vercel default project domains do not include wildcard cert coverage for
    // arbitrary merchant subdomains (e.g. <slug>.<project>.vercel.app).
    // In auto mode, keep the working query URL unless a wildcard-capable
    // custom root domain is configured.
    if (
        normalizedHost.endsWith('.vercel.app')
        && (!rootDomain || rootDomain.endsWith('.vercel.app'))
    ) {
        return true;
    }

    return false;
}

export function getStorefrontRootDomain(hostname: string): string {
    return resolveRootDomain(hostname);
}

export function getStoreSlugFromHostname(hostname: string): string {
    const normalizedHost = hostname.trim().toLowerCase();
    if (!normalizedHost) {
        return '';
    }

    if (normalizedHost === 'localhost') {
        return '';
    }

    if (normalizedHost.endsWith('.localhost')) {
        const candidate = normalizeSlug(normalizedHost.slice(0, -'.localhost'.length));
        return isValidStoreSlug(candidate) ? candidate : '';
    }

    const rootDomain = resolveRootDomain(normalizedHost);
    if (!rootDomain || normalizedHost === rootDomain) {
        return '';
    }

    const expectedSuffix = `.${rootDomain}`;
    if (!normalizedHost.endsWith(expectedSuffix)) {
        return '';
    }

    const candidate = normalizeSlug(normalizedHost.slice(0, -expectedSuffix.length));
    if (!candidate || candidate.includes('.')) {
        return '';
    }

    return isValidStoreSlug(candidate) ? candidate : '';
}

export function getStoreSlugFromLocation(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    const slugFromHost = getStoreSlugFromHostname(window.location.hostname);
    if (slugFromHost) {
        return slugFromHost;
    }

    // Backward compatibility for old links that still use ?store=slug.
    try {
        const params = new URLSearchParams(window.location.search);
        const slugFromQuery = normalizeSlug(String(params.get('store') || ''));
        return isValidStoreSlug(slugFromQuery) ? slugFromQuery : '';
    } catch {
        return '';
    }
}

export function buildStorefrontOrigin(slug: string, locationLike: Location = window.location): string {
    const normalizedSlug = normalizeSlug(slug);
    if (!isValidStoreSlug(normalizedSlug)) {
        return '';
    }

    if (shouldUseQueryStoreParam(locationLike)) {
        const portSuffix = locationLike.port ? `:${locationLike.port}` : '';
        return `${locationLike.protocol}//${locationLike.hostname}${portSuffix}`;
    }

    const rootDomain = resolveRootDomain(locationLike.hostname);
    if (!rootDomain) {
        return '';
    }

    const hostWithSubdomain = `${normalizedSlug}.${rootDomain}`;
    const portSuffix = locationLike.port ? `:${locationLike.port}` : '';
    return `${locationLike.protocol}//${hostWithSubdomain}${portSuffix}`;
}

export function buildStorefrontUrl(slug: string, pathname = '/storefront', locationLike: Location = window.location): string {
    const normalizedSlug = normalizeSlug(slug);
    if (!isValidStoreSlug(normalizedSlug)) {
        return '';
    }

    const origin = buildStorefrontOrigin(normalizedSlug, locationLike);
    if (!origin) {
        return '';
    }

    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    if (shouldUseQueryStoreParam(locationLike)) {
        const url = new URL(normalizedPath, origin);
        url.searchParams.set('store', normalizedSlug);
        return url.toString();
    }

    return `${origin}${normalizedPath}`;
}
