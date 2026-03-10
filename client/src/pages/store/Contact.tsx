import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useOutletContext } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PublicStoreLayoutContext } from '@/layouts/PublicStoreLayout';
import { submitStoreContactMessage } from '@/services/api/publicStoreApi';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Please enter a valid email'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function PublicStoreContactPage() {
  const { slug, store } = useOutletContext<PublicStoreLayoutContext>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  });

  const contactMutation = useMutation({
    mutationFn: (payload: ContactFormValues) => submitStoreContactMessage(slug, payload),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const successMessage = await contactMutation.mutateAsync(values);
      setSubmitSuccess(successMessage);
      reset();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to send message';
      setSubmitError(message);
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Contact {store.name}</h1>
        <p className="text-sm text-muted-foreground">Reach out for product questions or order support.</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{store.address}</p>
          <p>{store.phone}</p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" placeholder="Your name" {...register('name')} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" type="email" placeholder="you@example.com" {...register('email')} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea id="contact-message" rows={5} placeholder="How can we help you?" {...register('message')} />
            {errors.message ? <p className="text-xs text-destructive">{errors.message.message}</p> : null}
          </div>

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          {submitSuccess ? <p className="text-sm text-emerald-600">{submitSuccess}</p> : null}

          <Button type="submit" disabled={contactMutation.isPending}>
            {contactMutation.isPending ? 'Sending...' : 'Send Message'}
          </Button>
        </form>
      </section>
    </div>
  );
}
