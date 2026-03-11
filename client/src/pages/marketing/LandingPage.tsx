import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  CreditCard,
  Headphones,
  Play,
  Shield,
  ShoppingBag,
  Users,
} from 'lucide-react';

const stats = [
  { label: 'Active merchants', value: '50k+' },
  { label: 'GMV processed', value: 'NPR 500M+' },
  { label: 'Integrations', value: '100+' },
  { label: 'Support', value: '24/7 human' },
];

const features = [
  {
    title: 'Online Store',
    description: 'Beautiful, customizable storefronts that convert visitors into customers.',
    icon: ShoppingBag,
    iconColor: 'text-sky-600',
    iconBg: 'bg-sky-100',
  },
  {
    title: 'Analytics',
    description: 'Real-time insights and reports to make data-driven decisions.',
    icon: BarChart3,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
  },
  {
    title: 'Payments',
    description: 'Accept payments globally with 100+ payment gateways supported.',
    icon: CreditCard,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
  },
  {
    title: 'Inventory',
    description: 'Track stock levels across multiple locations effortlessly.',
    icon: Boxes,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
  {
    title: 'Marketing',
    description: 'Built-in SEO, email marketing, and social media tools.',
    icon: Shield,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  {
    title: '24/7 Support',
    description: 'Expert help whenever you need it, day or night.',
    icon: Headphones,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-100',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 'NPR 999/mo',
    highlight: false,
    features: ['Up to 100 products', 'Basic analytics', '2% transaction fee', 'Email support'],
  },
  {
    name: 'Professional',
    price: 'NPR 2,999/mo',
    highlight: true,
    features: ['Unlimited products', 'Advanced analytics', '1% transaction fee', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    highlight: false,
    features: ['Everything in Pro', 'Custom integrations', '0% transaction fee', 'Dedicated manager'],
  },
];

const aboutBullets = [
  'Built for Nepali entrepreneurs by Nepali founders',
  'Localized payments, logistics, and tax support',
  'World-class tools with a simple, modern experience',
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-sky-50 via-white to-transparent" />
      <div className="absolute right-[-10%] top-[-10%] -z-10 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl" aria-hidden />
      <div className="absolute left-[-12%] top-20 -z-10 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl" aria-hidden />

      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold">Dhukuti</div>
              <p className="text-xs text-slate-500">Commerce for Nepal</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#about" className="hover:text-slate-900">About</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/dashboard/login" className="text-sm font-semibold text-slate-700 hover:text-slate-900">
              Log in
            </Link>
            <Link
              to="/dashboard/register"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-500/30 transition hover:shadow-lg hover:shadow-cyan-500/40"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-6 pb-16 pt-10 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Trusted by 50,000+ businesses
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Build Your{' '}
                <span className="bg-gradient-to-r from-sky-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">
                  Digital Empire
                </span>{' '}
                Today
              </h1>
              <p className="max-w-2xl text-lg text-slate-600">
                Dhukuti is the all-in-one commerce platform that helps you start, grow, and manage your business. From beautiful storefronts to powerful analytics.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/dashboard/register"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard/login"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-400"
              >
                Log in
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                <Play className="h-4 w-4" />
                Watch demo
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-left sm:grid-cols-4">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="text-2xl font-semibold text-slate-900">{item.value}</div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-10 lg:mt-0">
            <div className="glass-card hover-raise relative overflow-hidden rounded-3xl p-6">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Today's Revenue</span>
                <span className="text-emerald-500">+24.5%</span>
              </div>
              <div className="mt-4 text-4xl font-semibold text-slate-900">NPR 245,890</div>

              <div className="mt-8 flex items-end gap-2">
                {[40, 60, 45, 80, 65, 90, 70].map((height, index) => (
                  <div
                    key={`bar-${index}`}
                    className={`flex-1 rounded-t-lg ${index === 5 ? 'bg-sky-500' : 'bg-sky-500/40'}`}
                    style={{ height: `${height}%`, minHeight: '60px' }}
                  />
                ))}
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Orders today</p>
                  <p className="text-lg font-semibold text-slate-900">156</p>
                  <p className="text-xs text-emerald-500">+8.2%</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Customers</p>
                  <p className="text-lg font-semibold text-slate-900">2,450</p>
                  <p className="text-xs text-emerald-500">+24.1%</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Conversion</p>
                  <p className="text-lg font-semibold text-slate-900">3.2%</p>
                  <p className="text-xs text-red-500">-2.4%</p>
                </div>
              </div>

              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-100/70 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -left-14 bottom-6 h-36 w-36 rounded-full bg-emerald-100/60 blur-3xl" aria-hidden />
            </div>
          </div>
        </section>

        <section id="features" className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Everything You Need to Succeed</h2>
              <p className="mt-3 text-lg text-slate-600">Powerful features designed for modern commerce. Scale your business with confidence.</p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="glass-card hover-raise rounded-2xl p-7">
                  <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-xl ${feature.iconBg}`}>
                    <feature.icon className={`h-7 w-7 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="bg-gradient-to-b from-slate-50 to-white py-16">
          <div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <SparkIcon />
                About Dhukuti
              </div>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Built for ambitious businesses in Nepal</h2>
              <p className="text-lg text-slate-600">
                We believe every business deserves access to world-class commerce tools. Dhukuti empowers entrepreneurs to compete globally with a platform tuned for local needs.
              </p>

              <div className="space-y-3">
                {aboutBullets.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="mt-[2px] h-5 w-5 text-emerald-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                  <Users className="h-4 w-4 text-sky-600" />
                  50k+ users
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  Secure by design
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm">
                  <Headphones className="h-4 w-4 text-indigo-600" />
                  Local support
                </div>
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <div className="glass-card rounded-3xl p-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-2xl text-white">
                    👨‍💼
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Founder &amp; CEO</p>
                    <h4 className="text-lg font-semibold text-slate-900">Rikesh Karmarcharya </h4>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  “We started Dhukuti because small businesses in Nepal were struggling with tools built for other markets. Our vision is a platform that speaks the language of Nepali entrepreneurs.”
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-16">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Simple, Transparent Pricing</h2>
            <p className="mt-3 text-lg text-slate-600">Start free, upgrade as you grow. No hidden fees.</p>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`glass-card hover-raise flex flex-col rounded-2xl p-7 text-left ${plan.highlight ? 'border-2 border-sky-500 shadow-lg shadow-sky-500/10' : ''
                    }`}
                >
                  {plan.highlight && (
                    <div className="mb-3 inline-flex w-max items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                      Most popular
                    </div>
                  )}
                  <p className={plan.highlight ? 'text-sky-600 font-semibold' : 'text-slate-500 font-semibold'}>
                    {plan.name}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{plan.price}</p>

                  <ul className="mt-5 space-y-3 text-sm text-slate-600">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/dashboard/register"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${plan.highlight
                        ? 'bg-sky-500 text-white hover:bg-sky-600'
                        : 'border border-slate-300 text-slate-900 hover:border-slate-400'
                      }`}
                  >
                    {plan.name === 'Enterprise' ? 'Contact sales' : 'Get started'}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mb-16 max-w-6xl px-6">
          <div className="glass-card rounded-3xl bg-slate-900 px-8 py-10 text-center text-white shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Ready to launch?</p>
            <h3 className="mt-2 text-3xl font-bold">Bring your store to life with Dhukuti</h3>
            <p className="mt-3 text-slate-200">
              Start a 14-day free trial, explore the dashboard, and go live when you&apos;re ready.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/dashboard/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard/login"
                className="inline-flex items-center gap-2 rounded-xl border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-600 sm:flex-row">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-semibold">Dhukuti</span>
          </div>
          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <span>© 2026 Dhukuti. All rights reserved.</span>
            <span className="hidden text-slate-400 sm:inline" aria-hidden>
              •
            </span>
            <Link to="/dashboard/login" className="text-slate-700 hover:text-slate-900">
              Merchant login
            </Link>
            <Link to="/dashboard/register" className="text-slate-700 hover:text-slate-900">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L13.9021 8.09789L20 10L13.9021 11.9021L12 18L10.0979 11.9021L4 10L10.0979 8.09789L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
