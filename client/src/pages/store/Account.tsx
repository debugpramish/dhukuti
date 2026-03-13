import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PublicStoreLayoutContext } from '@/layouts/PublicStoreLayout';
import type { AuthUser } from '@/lib/auth';
import {
  clearCustomerAuthSession,
  getCustomerAuthToken,
  getStoredCustomerUser,
  storeCustomerAuthSession,
} from '@/lib/customer-auth';
import { loginCustomerAccount, signupCustomerAccount } from '@/services/api/authApi';

type AuthMode = 'login' | 'signup';

function sanitizeNextPath(rawNextPath: string | null, slug: string): string {
  const fallbackPath = `/store/${slug}`;
  if (!rawNextPath) {
    return fallbackPath;
  }

  const nextPath = rawNextPath.trim();
  if (!nextPath.startsWith(`/store/${slug}`)) {
    return fallbackPath;
  }

  return nextPath;
}

export default function PublicStoreAccountPage() {
  const { slug, store } = useOutletContext<PublicStoreLayoutContext>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login',
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerUser, setCustomerUser] = useState<AuthUser | null>(() => getStoredCustomerUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => Boolean(getCustomerAuthToken() && getStoredCustomerUser()),
  );

  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next'), slug), [searchParams, slug]);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const rememberMe = formData.get('rememberMe') === 'on';

    setAuthError(null);
    setIsSubmitting(true);

    try {
      const authPayload = await loginCustomerAccount({ email, password }, slug);
      storeCustomerAuthSession(authPayload.token, authPayload.user, rememberMe);
      setCustomerUser(authPayload.user);
      setIsAuthenticated(true);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to login with this account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const address = String(formData.get('address') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    const rememberMe = formData.get('rememberMe') === 'on';

    setAuthError(null);
    setIsSubmitting(true);

    try {
      const authPayload = await signupCustomerAccount(
        {
          name,
          email,
          phone,
          address,
          password,
          confirmPassword,
        },
        slug,
      );
      storeCustomerAuthSession(authPayload.token, authPayload.user, rememberMe);
      setCustomerUser(authPayload.user);
      setIsAuthenticated(true);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to create customer account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearCustomerAuthSession();
    setCustomerUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
  };

  return (
    <section className="mx-auto w-full max-w-xl rounded-xl border bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Customer account</h1>
        <p className="text-sm text-slate-600">
          Sign in as a customer to place orders from {store.name}.
        </p>
      </div>

      {isAuthenticated && customerUser ? (
        <div className="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="text-sm font-medium text-emerald-900">{customerUser.name}</p>
            <p className="text-sm text-emerald-700">{customerUser.email}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => navigate(nextPath)} className="bg-slate-900 text-white hover:bg-slate-800">
              Continue shopping
            </Button>
            <Button type="button" variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="inline-flex rounded-md border border-slate-300 p-1">
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                authMode === 'login' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                authMode === 'signup' ? 'bg-slate-900 text-white' : 'text-slate-700'
              }`}
              onClick={() => setAuthMode('signup')}
            >
              Create account
            </button>
          </div>

          {authMode === 'login' ? (
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div className="space-y-2">
                <Label htmlFor="customer-login-email">Email</Label>
                <Input id="customer-login-email" name="email" type="email" required autoComplete="email" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-login-password">Password</Label>
                <Input
                  id="customer-login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="rememberMe" className="size-4 rounded border-slate-300" />
                Remember me
              </label>

              <Button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white hover:bg-slate-800">
                {isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSignupSubmit}>
              <div className="space-y-2">
                <Label htmlFor="customer-signup-name">Full name</Label>
                <Input id="customer-signup-name" name="name" required autoComplete="name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-signup-email">Email</Label>
                <Input id="customer-signup-email" name="email" type="email" required autoComplete="email" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-signup-phone">Phone</Label>
                <Input id="customer-signup-phone" name="phone" type="tel" required autoComplete="tel" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-signup-address">Address</Label>
                <textarea
                  id="customer-signup-address"
                  name="address"
                  rows={3}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-signup-password">Password</Label>
                <Input
                  id="customer-signup-password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-signup-confirm-password">Confirm password</Label>
                <Input
                  id="customer-signup-confirm-password"
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="rememberMe" className="size-4 rounded border-slate-300" />
                Remember me
              </label>

              <Button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white hover:bg-slate-800">
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          )}

          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
        </div>
      )}

      <div className="mt-6 border-t pt-4">
        <Link to={nextPath} className="text-sm font-medium text-slate-700 hover:text-slate-900">
          Back to store
        </Link>
      </div>
    </section>
  );
}
