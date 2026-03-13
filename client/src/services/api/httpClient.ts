import { getAuthToken } from '@/lib/auth';

const rawApiUrl = import.meta.env.VITE_API_URL;
const API_V1_PREFIX = '/api/v1';

export const API_BASE_URL =
  typeof rawApiUrl === 'string' && rawApiUrl.trim().length > 0
    ? rawApiUrl.replace(/\/$/, '')
    : 'http://localhost:5000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type SerializableBody = Record<string, unknown>;
type RequestBody = BodyInit | SerializableBody | undefined;

type ApiRequestInit = Omit<RequestInit, 'body' | 'headers'> & {
  body?: RequestBody;
  headers?: HeadersInit;
  skipAuth?: boolean;
};

type ApiEnvelope<T> = T | { data: T };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildRequestBody(body: RequestBody): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }

  if (
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    typeof body === 'string' ||
    body instanceof ReadableStream ||
    ArrayBuffer.isView(body) ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function buildHeaders(body: RequestBody, headers: HeadersInit | undefined, skipAuth: boolean): Headers {
  const mergedHeaders = new Headers(headers);

  if (body !== undefined && !(body instanceof FormData) && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (!skipAuth && token && !mergedHeaders.has('Authorization')) {
    mergedHeaders.set('Authorization', `Bearer ${token}`);
  }

  return mergedHeaders;
}

function extractErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.message === 'string') {
    return payload.message;
  }

  return 'Request failed';
}

function resolvePath(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // If VITE_API_URL already ends with /api/v1, don't duplicate the prefix.
  if (API_BASE_URL.endsWith(API_V1_PREFIX) && normalizedPath.startsWith(`${API_V1_PREFIX}/`)) {
    return `${API_BASE_URL}${normalizedPath.slice(API_V1_PREFIX.length)}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function httpRequest<TResponse>(path: string, init: ApiRequestInit = {}): Promise<TResponse> {
  const response = await fetch(resolvePath(path), {
    ...init,
    body: buildRequestBody(init.body),
    headers: buildHeaders(init.body, init.headers, Boolean(init.skipAuth)),
  });

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload), response.status);
  }

  return payload as TResponse;
}

export function unwrapData<T>(response: ApiEnvelope<T>): T {
  if (isRecord(response) && 'data' in response) {
    return response.data as T;
  }

  return response as T;
}
