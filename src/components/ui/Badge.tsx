import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'live';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  default: 'bg-surface-700 text-surface-200',
  primary: 'bg-primary-600/20 text-primary-300 border border-primary-600/40',
  success: 'bg-green-600/20 text-green-300 border border-green-600/40',
  warning: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  danger: 'bg-red-600/20 text-red-300 border border-red-600/40',
  live: 'bg-red-600 text-white',
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
