import { useEffect } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useStorefrontUiStore } from '@/stores/storefront-ui-store';

function ToastItem({ id, title, description, variant }: { id: string; title: string; description?: string; variant: 'success' | 'error' | 'info' }) {
  const removeToast = useStorefrontUiStore((state) => state.removeToast);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      removeToast(id);
    }, 3800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [id, removeToast]);

  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-lg border bg-white p-4 shadow-lg transition-all',
        variant === 'success' && 'border-emerald-200',
        variant === 'error' && 'border-red-200',
        variant === 'info' && 'border-slate-200',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? <p className="text-sm text-slate-600">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => removeToast(id)}
          className="rounded p-1 text-slate-500 transition hover:bg-slate-100"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function StoreToaster() {
  const toasts = useStorefrontUiStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-full max-w-sm flex-col gap-2 sm:right-6">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
        />
      ))}
    </div>
  );
}
