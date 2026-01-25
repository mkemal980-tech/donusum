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
          'border-transparent bg-[var(--blue-main)] text-white hover:bg-[var(--blue-dark)]',
        destructive:
          'border-transparent bg-[var(--error)] text-white hover:opacity-90',
        outline: 'text-[var(--text-main)] border-[var(--border-soft)]',
        success:
          'border-transparent bg-[rgba(12,193,195,0.15)] text-[var(--accent)]',
        warning:
          'border-transparent bg-[rgba(245,158,11,0.15)] text-amber-400',
        info:
          'border-transparent bg-[rgba(46,134,255,0.15)] text-[var(--blue-main)]',
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
