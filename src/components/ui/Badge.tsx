import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'live';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  default: 'bg-muted text-foreground',
  primary: 'bg-primary/20 text-primary border border-primary/40',
  success: 'bg-success/20 text-success border border-success/40',
  warning: 'bg-warning/20 text-warning border border-warning/40',
  danger: 'bg-destructive/20 text-destructive border border-destructive/40',
  live: 'bg-destructive text-white',
};

export function Badge({ tone = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
