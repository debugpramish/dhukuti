import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useSeo } from '@/hooks/use-seo';
import { useStorefrontAuthStore } from '@/stores/storefront-auth-store';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';

function sanitizeNextPath(rawNext: string | null): string {
  if (!rawNext) {
    return '/account';
  }

  const nextPath = rawNext.trim();
  if (!nextPath.startsWith('/')) {
    return '/account';
  }

  return nextPath;
}

export default function LoginPage() {
  useSeo({
    title: 'Login',
    description: 'Sign in to manage account details and complete checkout.',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get('next'));

  const { login, isAuthenticated, isAuthPending, authError, clearAuthError } = useStorefrontAuthStore();
  const pushToast = useStorefrontUiStore((state) => state.pushToast);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (isAuthenticated) {
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthError();

    try {
      await login({ email: email.trim(), password });
      pushToast({
        variant: 'success',
        title: 'Welcome back',
        description: 'You are logged in.',
      });
      navigate(nextPath, { replace: true });
    } catch {
      // Error state is managed by the auth store.
    }
  };

  return (
    <div className="premium-route premium-route-auth mx-auto grid w-full max-w-4xl gap-6 lg:grid-cols-[0.9fr_1fr]">
      <aside className="storefront-panel premium-hero relative hidden overflow-hidden p-6 lg:block">
        <div className="pointer-events-none absolute -left-8 -top-10 h-36 w-36 rounded-full bg-amber-300/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="relative space-y-3">
          <span className="storefront-kicker">Maison Access</span>
          <h2 className="storefront-heading text-3xl font-semibold text-slate-900">Enter Your Private Customer Lounge</h2>
          <p className="text-sm text-slate-600">
            Sign in to track shipments, save wishlists, and checkout faster with saved information.
          </p>
        </div>
      </aside>

      <section className="storefront-panel p-6">
        <h1 className="storefront-heading text-3xl font-semibold text-slate-900">Client Login</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to track tailored orders and priority delivery updates.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="storefront-input"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="storefront-input"
            />
          </label>

          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}

          <Button type="submit" className="w-full rounded-full" disabled={isAuthPending}>
            {isAuthPending ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          New customer?{' '}
          <Link to={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-slate-900 hover:underline">
            Create account
          </Link>
        </p>
      </section>
    </div>
  );
}
