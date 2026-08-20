import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--accent)] text-[var(--bg-deep)] hover:bg-[var(--accent-bright)]',
        secondary:
          'border-transparent bg-[var(--accent-press)] text-[var(--on-accent)] hover:bg-[var(--accent-solid)]',
        destructive:
          'border-transparent bg-[var(--error-solid)] text-[var(--on-accent)] hover:opacity-90',
        outline: 'text-[var(--text-main)] border-[var(--border-soft)]',
        success:
          'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]',
        warning:
          'border-transparent bg-[var(--warning-bg)] text-[var(--warning-ink)]',
        info:
          'border-transparent bg-[var(--info-bg)] text-[var(--accent-ink)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
