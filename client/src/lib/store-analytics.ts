const STORE_SESSION_PREFIX = 'dhukuti:store-session';
const TRAFFIC_SOURCE_KEY = 'dhukuti:traffic-source';

function buildStoreSessionStorageKey(slug: string): string {
  return `${STORE_SESSION_PREFIX}:${slug}`;
}

function sanitizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `sess-${Date.now().toString(36)}-${randomPart}`;
}

export function getOrCreateStoreSessionId(slug: string): string {
  if (typeof window === 'undefined') {
    return buildSessionId();
  }

  const storageKey = buildStoreSessionStorageKey(slug);
  const existing = window.localStorage.getItem(storageKey);
  if (existing && /^[A-Za-z0-9-]{8,120}$/.test(existing)) {
    return existing;
  }

  const generated = buildSessionId();
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

function deriveTrafficSourceFromLocation(): string {
  if (typeof window === 'undefined') {
    return 'direct';
  }

  const query = new URLSearchParams(window.location.search);
  const candidates = [
    query.get('utm_source'),
    query.get('source'),
    query.get('ref'),
  ];

  for (const candidate of candidates) {
    const sanitized = sanitizeToken(candidate ?? '');
    if (sanitized) {
      return sanitized;
    }
  }

  const referrer = document.referrer;
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const currentHost = window.location.hostname;
      if (referrerUrl.hostname && referrerUrl.hostname !== currentHost) {
        return sanitizeToken(referrerUrl.hostname) || 'referral';
      }
    } catch {
      // Ignore malformed referrer values.
    }
  }

  return 'direct';
}

export function getStoredTrafficSource(): string {
  if (typeof window === 'undefined') {
    return 'direct';
  }

  const existing = window.sessionStorage.getItem(TRAFFIC_SOURCE_KEY);
  const sanitizedExisting = sanitizeToken(existing ?? '');
  if (sanitizedExisting) {
    return sanitizedExisting;
  }

  const derived = deriveTrafficSourceFromLocation();
  window.sessionStorage.setItem(TRAFFIC_SOURCE_KEY, derived);
  return derived;
}
