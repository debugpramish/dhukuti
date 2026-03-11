import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import Navbar from '@/components/dashboard/Navbar';
import Sidebar from '@/components/dashboard/Sidebar';
import { Button } from '@/components/ui/button';
import { clearAuthSession, getStoredUser } from '@/lib/auth';
import { getStoreSettings } from '@/services/api/storeApi';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const user = getStoredUser();

  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings'],
    queryFn: getStoreSettings,
    retry: 1,
  });

  const handleLogout = () => {
    clearAuthSession();
    navigate('/dashboard/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="fixed inset-y-0 left-0 hidden w-64 md:block">
        <Sidebar />
      </div>

      {isMobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <div className="relative h-full w-72 bg-background shadow-xl">
            <div className="flex h-16 items-center justify-end border-b px-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close sidebar</span>
              </Button>
            </div>
            <Sidebar onNavigate={() => setIsMobileSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="md:pl-64">
        <Navbar
          storeName={storeSettings?.name || 'My Store'}
          profileName={user?.name || 'Merchant'}
          profileEmail={user?.email || 'merchant@example.com'}
          onMenuClick={() => setIsMobileSidebarOpen(true)}
          onLogout={handleLogout}
        />

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
