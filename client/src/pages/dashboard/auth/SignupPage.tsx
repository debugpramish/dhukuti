import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api';
import { type AuthUser, getAuthToken, storeAuthSession } from '@/lib/auth';

type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

export default function SignupPage() {
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
    const name = String(formData.get('name') ?? '');
    const email = String(formData.get('email') ?? '');
    const phone = String(formData.get('phone') ?? '');
    const address = String(formData.get('address') ?? '');
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (password !== confirmPassword) {
      setError('Password and confirm password must match.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiRequest<AuthResponse>('/api/v1/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          password,
          confirmPassword,
        }),
      });

      storeAuthSession(response.token, response.user, true);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Unable to create account with provided details';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-tealLight via-white to-brand-goldLight px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-4xl rounded-3xl border border-brand-teal/20 bg-white p-6 shadow-2xl shadow-brand-teal/10 sm:p-10">
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <h1 className="font-display text-3xl text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-600">
            Fill in your details to get started with Dhukuti.
          </p>

          <form className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Full name</span>
              <input
                type="text"
                name="name"
                required
                autoComplete="name"
                placeholder="Your full name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Phone number</span>
              <input
                type="tel"
                name="phone"
                required
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-700">Address</span>
              <textarea
                name="address"
                required
                autoComplete="street-address"
                rows={3}
                placeholder="Street, city, state"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Confirm password</span>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
            </label>

            <label className="flex items-start gap-3 sm:col-span-2">
              <input
                type="checkbox"
                name="terms"
                required
                className="mt-1 size-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal/30"
              />
              <span className="text-sm text-slate-700">
                I agree to the terms and privacy policy.
              </span>
            </label>

            {error && <p className="sm:col-span-2 text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="sm:col-span-2 rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/dashboard/login" className="font-semibold text-brand-teal hover:text-teal-900">
              Login
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
