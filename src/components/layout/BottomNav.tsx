import { NavLink } from 'react-router-dom';
import { Trophy, User, Bell, Shield } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Trophy;
  end?: boolean;
  adminOnly?: boolean;
}

const items: NavItem[] = [
  { to: '/', label: 'Tornei', icon: Trophy, end: true },
  { to: '/profilo', label: 'Profilo', icon: User },
  { to: '/impostazioni/notifiche', label: 'Notifiche', icon: Bell },
  { to: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
];

export function BottomNav() {
  const { isAdmin } = useSession();
  const visible = items.filter((i) => !i.adminOnly || isAdmin);

  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {visible.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
