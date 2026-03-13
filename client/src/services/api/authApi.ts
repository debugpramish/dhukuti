import type { AuthUser } from '@/lib/auth';

import { httpRequest } from './httpClient';

type AuthPayload = {
  token?: string;
  user?: AuthUser;
};

type AuthResponse = AuthPayload | { data: AuthPayload };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveAuthPayload(response: AuthResponse): AuthPayload {
  if (isRecord(response) && 'data' in response && isRecord(response.data)) {
    return response.data as AuthPayload;
  }

  return response as AuthPayload;
}

function requireAuthPayload(response: AuthResponse): { token: string; user: AuthUser } {
  const payload = resolveAuthPayload(response);
  if (!payload.token || !payload.user) {
    throw new Error('Invalid authentication response');
  }

  return {
    token: payload.token,
    user: payload.user,
  };
}

export type LoginInput = {
  email: string;
  password: string;
};

export type SignupInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  confirmPassword: string;
};

async function requestCustomerAuth(
  paths: string[],
  payload: LoginInput | SignupInput,
): Promise<{ token: string; user: AuthUser }> {
  let lastError: unknown;

  for (const path of paths) {
    try {
      const response = await httpRequest<AuthResponse>(path, {
        method: 'POST',
        body: payload,
        skipAuth: true,
      });

      return requireAuthPayload(response);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('Customer authentication failed');
}

function buildAuthPaths(storeSlug: string, action: 'login' | 'register'): string[] {
  const normalized = storeSlug.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Store slug is required for customer authentication');
  }

  return [
    `/api/v1/auth/store/${encodeURIComponent(normalized)}/customers/${action === 'login' ? 'login' : 'register'}`,
    `/auth/store/${encodeURIComponent(normalized)}/customers/${action === 'login' ? 'login' : 'register'}`,
    `/api/v1/auth/stores/${encodeURIComponent(normalized)}/customers/${action === 'login' ? 'login' : 'register'}`,
    `/auth/stores/${encodeURIComponent(normalized)}/customers/${action === 'login' ? 'login' : 'register'}`,
  ];
}

export async function loginCustomerAccount(
  payload: LoginInput,
  storeSlug: string,
): Promise<{ token: string; user: AuthUser }> {
  const paths = buildAuthPaths(storeSlug, 'login');
  const response = await requestCustomerAuth(paths, payload);

  return response;
}

export async function signupCustomerAccount(
  payload: SignupInput,
  storeSlug: string,
): Promise<{ token: string; user: AuthUser }> {
  const paths = buildAuthPaths(storeSlug, 'register');
  const response = await requestCustomerAuth(paths, payload);

  return response;
}
