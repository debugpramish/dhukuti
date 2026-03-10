import { LogOut, Menu, Store } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavbarProps = {
  storeName: string;
  profileName: string;
  profileEmail: string;
  onMenuClick: () => void;
  onLogout: () => void;
};

export default function Navbar({
  storeName,
  profileName,
  profileEmail,
  onMenuClick,
  onLogout,
}: NavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!profileRef.current) {
        return;
      }

      if (!profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{storeName}</p>
              <p className="text-xs text-muted-foreground">Merchant dashboard</p>
            </div>
          </div>
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setIsProfileOpen((value) => !value)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted',
              isProfileOpen ? 'bg-muted' : 'bg-background',
            )}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {profileName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-none">{profileName}</span>
              <span className="block text-xs text-muted-foreground">Account</span>
            </span>
          </button>

          {isProfileOpen ? (
            <div className="absolute right-0 mt-2 w-64 rounded-md border bg-background p-2 shadow-lg">
              <div className="px-2 py-2">
                <p className="truncate text-sm font-medium">{profileName}</p>
                <p className="truncate text-xs text-muted-foreground">{profileEmail}</p>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
