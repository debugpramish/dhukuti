import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getStoreSettings, updateStoreSettings, uploadStoreLogo } from '@/services/api/storeApi';

const settingsSchema = z.object({
  name: z.string().min(2, 'Store name must be at least 2 characters long.'),
  description: z.string().min(10, 'Store description must be at least 10 characters long.'),
  phone: z.string().min(7, 'Phone number is too short.'),
  address: z.string().min(5, 'Address must be at least 5 characters long.'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['store-settings'],
    queryFn: getStoreSettings,
    retry: 1,
  });

  const updateStoreMutation = useMutation({
    mutationFn: updateStoreSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store-settings'] });
    },
  });
  const uploadStoreLogoMutation = useMutation({
    mutationFn: uploadStoreLogo,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['store-settings'] });
    },
  });

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      description: '',
      phone: '',
      address: '',
    },
  });

  useEffect(() => {
    if (!data) {
      return;
    }

    reset({
      name: data.name,
      description: data.description,
      phone: data.phone,
      address: data.address,
    });
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
  const publicStoreUrl = data?.slug ? `${window.location.origin}/?store=${encodeURIComponent(data.slug)}` : '';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setFormSuccess(null);

    try {
      await updateStoreMutation.mutateAsync(values);
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

              {data?.slug ? (
                <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Public store URL</p>
                  <a
                    href={publicStoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {publicStoreUrl}
                  </a>
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
