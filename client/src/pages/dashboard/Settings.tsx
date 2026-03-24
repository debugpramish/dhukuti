import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { setThemePreviewOverride } from '@/lib/storefront-theme';
import { buildStorefrontUrl, getStorefrontRootDomain } from '@/lib/storefront-url';
import {
  getStoreSettings,
  initiatePremiumThemePayment,
  updateStoreSettings,
  uploadStoreLogo,
  verifyAndActivatePremiumTheme,
} from '@/services/api/storeApi';

const settingsSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Storefront name must be at least 2 characters long.')
    .max(63, 'Storefront name cannot exceed 63 characters.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only.'),
  name: z.string().min(2, 'Store name must be at least 2 characters long.'),
  description: z.string().min(10, 'Store description must be at least 10 characters long.'),
  phone: z.string().min(7, 'Phone number is too short.'),
  address: z.string().min(5, 'Address must be at least 5 characters long.'),
  activeTheme: z.enum(['classic', 'maison_premium']),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [lastSavedSlug, setLastSavedSlug] = useState<string>('');
  const [themeActionState, setThemeActionState] = useState<string | null>(null);
  const hasHydratedFormRef = useRef(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['store-settings'],
    queryFn: getStoreSettings,
    retry: 1,
  });

  const updateStoreMutation = useMutation({
    mutationFn: updateStoreSettings,
  });
  const uploadStoreLogoMutation = useMutation({
    mutationFn: uploadStoreLogo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store-settings'] });
    },
  });
  const initiatePremiumThemePaymentMutation = useMutation({
    mutationFn: initiatePremiumThemePayment,
  });
  const verifyAndActivatePremiumThemeMutation = useMutation({
    mutationFn: verifyAndActivatePremiumTheme,
    onSuccess: (result) => {
      queryClient.setQueryData(['store-settings'], result.store);
    },
  });

  const {
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      slug: '',
      name: '',
      description: '',
      phone: '',
      address: '',
      activeTheme: 'classic',
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!hasHydratedFormRef.current) {
      setLastSavedSlug(String(data.slug || '').trim().toLowerCase());
      reset({
        slug: data.slug,
        name: data.name,
        description: data.description,
        phone: data.phone,
        address: data.address,
        activeTheme: data.activeTheme,
      });
      hasHydratedFormRef.current = true;
    }
  }, [data, reset]);

  useEffect(
    () => () => {
      if (logoPreviewUrl && logoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    },
    [logoPreviewUrl],
  );

  const displayedLogoPreviewUrl = logoPreviewUrl || data?.logoUrl || null;
  const displayedLogoFileName = logoFileName || (data?.logoUrl ? 'Current logo' : '');
  const draftSlug = String(watch('slug') || '').trim().toLowerCase();
  const savedSlug = String(lastSavedSlug || data?.slug || '').trim().toLowerCase();
  const publicStoreUrl = draftSlug ? buildStorefrontUrl(draftSlug, '/') : '';
  const savedPublicStoreUrl = savedSlug ? buildStorefrontUrl(savedSlug, '/') : '';
  const hasUnsavedSlugChange = Boolean(draftSlug && savedSlug && draftSlug !== savedSlug);
  const isSlugLocked = Boolean(data?.requiresSlugChangePayment);
  const selectedTheme = watch('activeTheme');
  const isPremiumThemeSelected = selectedTheme === 'maison_premium';
  const isPremiumThemeUnlocked = Boolean(data?.premiumTheme?.unlocked);
  const rootDomain = typeof window !== 'undefined' ? getStorefrontRootDomain(window.location.hostname) : '';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setFormSuccess(null);

    try {
      const submittedSlug = values.slug.trim().toLowerCase();
      const result = await updateStoreMutation.mutateAsync({
        ...values,
        slug: submittedSlug,
      });

      const persistedSlug = String(result.slug || submittedSlug).trim().toLowerCase();
      setLastSavedSlug(persistedSlug);

      queryClient.setQueryData(['store-settings'], {
        ...result,
        slug: persistedSlug,
      });
      reset({
        slug: persistedSlug,
        name: result.name,
        description: result.description,
        phone: result.phone,
        address: result.address,
        activeTheme: result.activeTheme,
      });

      const latestSettings = await getStoreSettings();
      const latestSlug = String(latestSettings.slug || '').trim().toLowerCase();
      if (latestSlug && latestSlug !== submittedSlug) {
        setFormError(`Slug save mismatch: requested "${submittedSlug}", server kept "${latestSlug}".`);
        return;
      }

      setFormSuccess('Store settings updated successfully.');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to update store settings.';
      setFormError(message);
    }
  });

  const handleLogoUpload = async (file: File) => {
    setFormError(null);
    setFormSuccess(null);

    try {
      await uploadStoreLogoMutation.mutateAsync(file);
      setFormSuccess('Store logo updated successfully.');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to upload store logo.';
      setFormError(message);
    }
  };

  const handlePremiumThemePreview = () => {
    const previewSlug = savedSlug || draftSlug;
    if (!previewSlug) {
      setFormError('Save your storefront slug first before opening premium preview.');
      return;
    }

    setThemePreviewOverride(previewSlug, 'maison_premium');
    const previewUrl = `${buildStorefrontUrl(previewSlug, '/storefront')}?themePreview=maison_premium`;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePremiumThemePurchase = async () => {
    setFormError(null);
    setThemeActionState('Initiating secure payment for premium theme...');

    try {
      const initiated = await initiatePremiumThemePaymentMutation.mutateAsync('khalti');
      setThemeActionState('Payment initiated. Verifying transaction and activating theme...');
      const activated = await verifyAndActivatePremiumThemeMutation.mutateAsync(initiated.paymentSessionId);

      setLastSavedSlug(String(activated.store.slug || '').trim().toLowerCase());
      reset({
        slug: activated.store.slug,
        name: activated.store.name,
        description: activated.store.description,
        phone: activated.store.phone,
        address: activated.store.address,
        activeTheme: activated.store.activeTheme,
      });

      setThemeActionState(null);
      setFormSuccess('Premium theme unlocked and activated successfully.');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to complete premium payment.';
      setThemeActionState(null);
      setFormError(message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage merchant store information and branding details.</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading store settings...
          </CardContent>
        </Card>
      ) : null}

      {isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load store settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Request failed'}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Store Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="store-slug">Storefront name</Label>
                  <div className="flex items-center rounded-md border bg-background">
                    <Input
                      id="store-slug"
                      className="border-0 shadow-none focus-visible:ring-0"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      readOnly={isSlugLocked}
                      aria-disabled={isSlugLocked}
                      {...register('slug')}
                    />
                    <span className="whitespace-nowrap pr-3 text-sm text-muted-foreground">
                      .{rootDomain || 'localhost'}
                    </span>
                  </div>
                  {errors.slug ? <p className="text-xs text-destructive">{errors.slug.message}</p> : null}
                  {isSlugLocked ? (
                    <p className="text-xs font-medium text-amber-700">
                      You already used your free storefront URL change. Additional URL changes require payment.
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Only this first part is editable. The domain suffix stays fixed.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store-name">Store name</Label>
                  <Input id="store-name" {...register('name')} />
                  {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store-phone">Phone</Label>
                  <Input id="store-phone" {...register('phone')} />
                  {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-description">Store description</Label>
                <Textarea id="store-description" rows={4} {...register('description')} />
                {errors.description ? <p className="text-xs text-destructive">{errors.description.message}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-address">Address</Label>
                <Textarea id="store-address" rows={3} {...register('address')} />
                {errors.address ? <p className="text-xs text-destructive">{errors.address.message}</p> : null}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Storefront Theme</p>
                  <p className="text-xs text-muted-foreground">
                    Merchants can preview premium anytime, but activation requires payment.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <input type="radio" value="classic" {...register('activeTheme')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Classic (Free)</p>
                      <p className="text-xs text-muted-foreground">Current storefront style and layout.</p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <input type="radio" value="maison_premium" {...register('activeTheme')} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Maison Premium</p>
                      <p className="text-xs text-muted-foreground">
                        Editorial luxury layout with animated premium visuals and live product sections.
                      </p>
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Price: NPR {data?.premiumTheme?.priceNpr ?? 4999}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={handlePremiumThemePreview}>
                    Preview Premium Theme
                  </Button>
                  {!isPremiumThemeUnlocked ? (
                    <Button
                      type="button"
                      onClick={() => void handlePremiumThemePurchase()}
                      disabled={
                        initiatePremiumThemePaymentMutation.isPending ||
                        verifyAndActivatePremiumThemeMutation.isPending
                      }
                    >
                      {initiatePremiumThemePaymentMutation.isPending || verifyAndActivatePremiumThemeMutation.isPending
                        ? 'Processing Payment...'
                        : `Pay NPR ${data?.premiumTheme?.priceNpr ?? 4999} & Activate`}
                    </Button>
                  ) : (
                    <p className="text-xs font-medium text-emerald-700">Premium theme already unlocked.</p>
                  )}
                </div>

                {isPremiumThemeSelected && !isPremiumThemeUnlocked ? (
                  <p className="text-xs text-amber-700">
                    Premium is selected but not yet unlocked. Use Pay & Activate to make it live for customers.
                  </p>
                ) : null}

                {themeActionState ? <p className="text-xs text-muted-foreground">{themeActionState}</p> : null}
              </div>

              {publicStoreUrl ? (
                <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Public store URL</p>
                  <a
                    href={savedPublicStoreUrl || '#'}
                    target={hasUnsavedSlugChange ? undefined : '_blank'}
                    rel={hasUnsavedSlugChange ? undefined : 'noreferrer'}
                    className={`text-sm font-medium underline-offset-4 ${hasUnsavedSlugChange ? 'cursor-not-allowed text-muted-foreground' : 'text-primary hover:underline'
                      }`}
                    onClick={(event) => {
                      if (hasUnsavedSlugChange) {
                        event.preventDefault();
                      }
                    }}
                  >
                    {hasUnsavedSlugChange ? publicStoreUrl : savedPublicStoreUrl}
                  </a>
                  {hasUnsavedSlugChange ? (
                    <p className="text-xs text-amber-600 font-medium">
                      Link is disabled. Save settings to activate the new storefront URL.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="store-logo">Store logo</Label>
                <Input
                  id="store-logo"
                  type="file"
                  accept="image/*"
                  disabled={uploadStoreLogoMutation.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    if (logoPreviewUrl && logoPreviewUrl.startsWith('blob:')) {
                      URL.revokeObjectURL(logoPreviewUrl);
                    }

                    setLogoPreviewUrl(URL.createObjectURL(file));
                    setLogoFileName(file.name);
                    void handleLogoUpload(file);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {uploadStoreLogoMutation.isPending
                    ? 'Uploading logo...'
                    : 'Upload a logo image. This will be visible in the public store navbar.'}
                </p>

                {displayedLogoPreviewUrl ? (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <img src={displayedLogoPreviewUrl} alt="Store logo preview" className="h-14 w-14 rounded-md object-cover" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{displayedLogoFileName || 'Logo preview'}</p>
                      <p className="text-xs text-muted-foreground">Preview only</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    Upload a logo to preview it
                  </div>
                )}
              </div>

              {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
              {formSuccess ? <p className="text-sm text-emerald-600">{formSuccess}</p> : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={updateStoreMutation.isPending}>
                  {updateStoreMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
