import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface TabItem {
  /** Path relativo (usato come `to` di NavLink). */
  to: string;
  label: string;
  /** Se true, il match della rotta è esatto (utile per l'indice). */
  end?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  className?: string;
}

/**
 * Barra di tab basata su NavLink: mantiene lo stato attivo in base alla rotta.
 * Usata nella shell di dettaglio torneo (le tab sono child route).
 */
export function Tabs({ items, className }: TabsProps) {
  return (
    <nav
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-border',
        className,
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
