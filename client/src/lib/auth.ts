const LOCAL_TOKEN_KEY = 'dhukuti_auth_token';
const SESSION_TOKEN_KEY = 'dhukuti_auth_token_session';
const USER_KEY = 'dhukuti_auth_user';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: string;
};

export function storeAuthSession(token: string, user: AuthUser, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem(LOCAL_TOKEN_KEY, token);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } else {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.removeItem(LOCAL_TOKEN_KEY);
  }

  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAuthToken() {
  return localStorage.getItem(LOCAL_TOKEN_KEY) || sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
}

export function getStoredUser(): AuthUser | null {
  const rawValue = localStorage.getItem(USER_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
