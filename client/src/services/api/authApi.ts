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

export async function loginCustomerAccount(payload: LoginInput): Promise<{ token: string; user: AuthUser }> {
  const response = await httpRequest<AuthResponse>('/auth/customer/login', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });

  return requireAuthPayload(response);
}

export async function signupCustomerAccount(payload: SignupInput): Promise<{ token: string; user: AuthUser }> {
  const response = await httpRequest<AuthResponse>('/auth/customer/signup', {
    method: 'POST',
    body: payload,
    skipAuth: true,
  });

  return requireAuthPayload(response);
}
