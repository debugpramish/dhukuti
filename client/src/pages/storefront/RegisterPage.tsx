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

export default function RegisterPage() {
  useSeo({
    title: 'Register',
    description: 'Create your customer account for faster checkout and order history.',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get('next'));

  const { register, isAuthenticated, isAuthPending, authError, clearAuthError } = useStorefrontAuthStore();
  const pushToast = useStorefrontUiStore((state) => state.pushToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  if (isAuthenticated) {
    return <Navigate to={nextPath} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthError();
    setValidationError('');

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        password,
      });
      pushToast({
        variant: 'success',
        title: 'Account created',
        description: 'You are now signed in.',
      });
      navigate(nextPath, { replace: true });
    } catch {
      // Error state is managed by the auth store.
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <section className="storefront-panel p-6">
        <h1 className="storefront-heading text-3xl font-semibold text-slate-900">Create Customer Account</h1>
        <p className="mt-1 text-sm text-slate-600">Register to track orders and save your preferences.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-600">Full name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoComplete="name"
                className="storefront-input"
              />
            </label>

            <label className="space-y-1 text-sm">
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

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-600">Phone</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                autoComplete="tel"
                className="storefront-input"
              />
            </label>

            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-600">Address</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                autoComplete="street-address"
                className="storefront-input"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-600">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="new-password"
                className="storefront-input"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-600">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                autoComplete="new-password"
                className="storefront-input"
              />
            </label>
          </div>

          {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}

          <Button type="submit" className="w-full rounded-full" disabled={isAuthPending}>
            {isAuthPending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-slate-900 hover:underline">
            Login
          </Link>
        </p>
      </section>
    </div>
  );
}
