import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

function Dialog({ open, onOpenChange, title, description, className, children }: DialogProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <button
        type="button"
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-label="Close dialog"
      />

      <div className="relative z-10 flex min-h-full items-start justify-center p-4 sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            'relative w-full max-w-xl overflow-y-auto rounded-xl border bg-background p-6 shadow-xl',
            'max-h-[calc(100vh-2rem)]',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { Dialog };
