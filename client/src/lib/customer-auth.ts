import type { AuthUser } from './auth';

const LOCAL_CUSTOMER_TOKEN_KEY = 'dhukuti_customer_auth_token';
const SESSION_CUSTOMER_TOKEN_KEY = 'dhukuti_customer_auth_token_session';
const CUSTOMER_USER_KEY = 'dhukuti_customer_auth_user';

export function storeCustomerAuthSession(token: string, user: AuthUser, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem(LOCAL_CUSTOMER_TOKEN_KEY, token);
    sessionStorage.removeItem(SESSION_CUSTOMER_TOKEN_KEY);
  } else {
    sessionStorage.setItem(SESSION_CUSTOMER_TOKEN_KEY, token);
    localStorage.removeItem(LOCAL_CUSTOMER_TOKEN_KEY);
  }

  localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
}

export function getCustomerAuthToken() {
  return localStorage.getItem(LOCAL_CUSTOMER_TOKEN_KEY) || sessionStorage.getItem(SESSION_CUSTOMER_TOKEN_KEY) || '';
}

export function getStoredCustomerUser(): AuthUser | null {
  const rawValue = localStorage.getItem(CUSTOMER_USER_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthUser;
  } catch {
    return null;
  }
}

export function clearCustomerAuthSession() {
  localStorage.removeItem(LOCAL_CUSTOMER_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_USER_KEY);
}
