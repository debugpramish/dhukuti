const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');
const API_V1_PREFIX = '/api/v1';
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // If the deployment URL already ends with /api/v1, avoid duplicating the prefix.
  if (API_BASE_URL.endsWith(API_V1_PREFIX) && normalizedPath.startsWith(`${API_V1_PREFIX}/`)) {
    return `${API_BASE_URL}${normalizedPath.slice(API_V1_PREFIX.length)}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

export async function apiRequest<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    abortController.abort();
  }, API_TIMEOUT_MS);

  const signal = init.signal ?? abortController.signal;

  let response: Response;

  try {
    response = await fetch(buildUrl(path), {
      ...init,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Please check server/database connection and try again.');
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : 'Request failed';

    throw new Error(message);
  }

  return data as TResponse;
}
