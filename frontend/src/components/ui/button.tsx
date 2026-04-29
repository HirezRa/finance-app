import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-primary/35 bg-primary/95 text-primary-foreground shadow-md shadow-primary/25 backdrop-blur-sm hover:bg-primary hover:shadow-lg hover:shadow-primary/35',
        destructive:
          'border border-destructive/35 bg-destructive/95 text-destructive-foreground shadow-md backdrop-blur-sm hover:bg-destructive',
        outline:
          'border border-white/30 bg-white/35 text-foreground shadow-sm backdrop-blur-md hover:bg-white/50 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/[0.15]',
        secondary:
          'border border-white/20 bg-secondary/90 text-secondary-foreground shadow-sm backdrop-blur-md hover:bg-secondary',
        ghost: 'hover:bg-white/15 dark:hover:bg-white/10',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-10 rounded-xl px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
