import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, MapPin, Phone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchStorefrontStore, submitStoreContactMessage } from '@/features/storefront/api/storefrontApi';
import { useSeo } from '@/hooks/use-seo';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';

export default function ContactPage() {
  useSeo({
    title: 'Contact',
    description: 'Send a message to the store team for support, order help, or product questions.',
  });

  const pushToast = useStorefrontUiStore((state) => state.pushToast);
  const { data: store } = useQuery({
    queryKey: ['storefront', 'store-info'],
    queryFn: fetchStorefrontStore,
    retry: 0,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      pushToast({
        variant: 'error',
        title: 'Incomplete form',
        description: 'Please fill your name, email, and message.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitStoreContactMessage({
        name,
        email,
        message,
      });
      pushToast({
        variant: 'success',
        title: 'Message sent',
        description: response.message,
      });
      setMessage('');
    } catch (error) {
      pushToast({
        variant: 'error',
        title: 'Unable to send message',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200/60 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-900 p-6 text-white shadow-[0_26px_60px_-36px_rgba(2,6,23,0.98)] sm:p-8">
        <h1 className="storefront-heading text-4xl font-semibold">Contact Us</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Have questions about products, delivery, or your order? Send a message and the store team will get back to
          you.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="storefront-surface space-y-3 rounded-2xl p-5">
          <h2 className="storefront-heading text-xl font-semibold text-slate-900">Store Details</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <p className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              {store?.address || 'Address not available'}
            </p>
            <p className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-500" />
              {store?.phone || 'Phone not available'}
            </p>
            <p className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              Support via this contact form
            </p>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="storefront-surface space-y-4 rounded-2xl p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              rows={6}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us how we can help..."
              required
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </Button>
        </form>
      </section>
    </div>
  );
}
