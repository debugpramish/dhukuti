import {
  BarChart3,
  Boxes,
  DollarSign,
  History,
  Layers,
  LayoutDashboard,
  LineChart,
  Settings,
  ShoppingBag,
  ShoppingCart,
  TicketPercent,
  Truck,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

type SidebarProps = {
  onNavigate?: () => void;
};

type SidebarItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
};

const sidebarItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: 'Products',
    to: '/dashboard/products',
    icon: Boxes,
  },
  {
    label: 'Inventory',
    to: '/dashboard/inventory',
    icon: Layers,
  },
  {
    label: 'Orders',
    to: '/dashboard/orders',
    icon: ShoppingCart,
  },
  {
    label: 'Abandoned Carts',
    to: '/dashboard/abandoned-carts',
    icon: History,
  },
  {
    label: 'Fulfillment',
    to: '/dashboard/fulfillment',
    icon: Truck,
  },
  {
    label: 'Analytics',
    to: '/dashboard/analytics',
    icon: LineChart,
  },
  {
    label: 'Reports',
    to: '/dashboard/reports',
    icon: BarChart3,
  },
  {
    label: 'Finance',
    to: '/dashboard/finance',
    icon: DollarSign,
  },
  {
    label: 'Customers',
    to: '/dashboard/customers',
    icon: Users,
  },
  {
    label: 'Coupons',
    to: '/dashboard/coupons',
    icon: TicketPercent,
  },
  {
    label: 'Settings',
    to: '/dashboard/settings',
    icon: Settings,
  },
];

export default function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full flex-col border-r bg-background">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShoppingBag className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Merchant Panel</p>
          <p className="text-xs text-muted-foreground">Theme-safe controls</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {sidebarItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t p-4 text-xs text-muted-foreground">
        Template lock enabled: only product image and pricing are editable.
      </div>
    </aside>
  );
}
