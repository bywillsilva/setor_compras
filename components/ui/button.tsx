import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'border border-transparent bg-[linear-gradient(135deg,#2f6bff_0%,#1e56df_100%)] text-primary-foreground shadow-[0_14px_32px_-18px_rgba(37,99,255,0.95)] hover:brightness-[1.05] hover:shadow-[0_16px_36px_-18px_rgba(37,99,255,0.85)]',
        destructive:
          'border border-transparent bg-[linear-gradient(135deg,#ef6c6c_0%,#d84f4f_100%)] text-white shadow-[0_14px_32px_-20px_rgba(216,79,79,0.95)] hover:brightness-[1.03] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-border/90 bg-white/85 text-foreground shadow-[0_10px_24px_-22px_rgba(14,33,72,0.6)] hover:border-primary/35 hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'border border-transparent bg-[linear-gradient(135deg,#102a60_0%,#0b1d46_100%)] text-secondary-foreground shadow-[0_14px_32px_-20px_rgba(11,29,70,0.9)] hover:brightness-[1.06]',
        ghost:
          'text-foreground/80 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
