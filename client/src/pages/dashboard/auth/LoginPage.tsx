import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { type AuthUser, getAuthToken, storeAuthSession } from '@/lib/auth';

type AuthPayload = {
  message?: string;
  token?: string;
  user?: AuthUser;
};

type AuthResponse = AuthPayload & {
  data?: AuthPayload;
};

function resolveAuthPayload(response: AuthResponse): { token: string; user: AuthUser } | null {
  const payload = response.data ?? response;

  if (!payload.token || !payload.user) {
    return null;
  }

  return {
    token: payload.token,
    user: payload.user,
  };
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (getAuthToken()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const rememberMe = formData.get('rememberMe') === 'on';

    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiRequest<AuthResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const authPayload = resolveAuthPayload(response);

      if (!authPayload) {
        throw new Error('Invalid login response from server');
      }

      storeAuthSession(authPayload.token, authPayload.user, rememberMe);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Unable to login with provided credentials';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-crimsonLight via-white to-brand-goldLight px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto flex w-full max-w-5xl overflow-hidden rounded-3xl border border-brand-crimson/15 bg-white shadow-2xl shadow-brand-crimson/10">
        <aside className="hidden w-2/5 bg-brand-crimson p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-goldLight">Dhukuti</p>
            <h1 className="font-display text-4xl leading-tight">
              Welcome back to your store dashboard.
            </h1>
            <p className="text-sm text-white/90">
              Sign in to track orders, update products, and manage customers.
            </p>
          </div>
          <p className="text-xs text-white/70">Simple, secure, and built for daily business.</p>
        </aside>

        <div className="w-full p-6 sm:p-10 lg:w-3/5">
          <div className="mx-auto w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
            <h2 className="font-display text-3xl text-slate-900">Login</h2>
            <p className="mt-1 text-sm text-slate-600">Use your email and password to continue.</p>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-crimson focus:ring-2 focus:ring-brand-crimson/20"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Password</span>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-crimson focus:ring-2 focus:ring-brand-crimson/20"
                />
              </label>

              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    className="size-4 rounded border-slate-300 text-brand-crimson focus:ring-brand-crimson/30"
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="font-medium text-brand-crimson hover:text-brand-crimsonDark">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-brand-crimson px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-crimsonDark"
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </button>

              {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            </form>

            <p className="mt-6 text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <Link to="/dashboard/register" className="font-semibold text-brand-crimson hover:text-brand-crimsonDark">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
