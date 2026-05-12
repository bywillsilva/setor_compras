import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'border-primary/15 bg-primary/10 text-[#1d4ed8] shadow-none [a&]:hover:bg-primary/14 dark:border-blue-400/35 dark:bg-blue-500/20 dark:text-blue-50',
        secondary:
          'border-[#102a60]/12 bg-[#102a60]/10 text-[#102a60] shadow-none [a&]:hover:bg-[#102a60]/14 dark:border-slate-500/35 dark:bg-slate-500/18 dark:text-slate-50',
        destructive:
          'border-destructive/15 bg-destructive/10 text-destructive [a&]:hover:bg-destructive/14 focus-visible:ring-destructive/20 dark:border-rose-400/35 dark:bg-rose-500/20 dark:text-rose-50 dark:focus-visible:ring-destructive/40',
        outline:
          'border-border/90 bg-white/88 text-foreground shadow-none [a&]:hover:bg-accent [a&]:hover:text-accent-foreground dark:border-[#34518a] dark:bg-[#162746] dark:text-slate-50 dark:[a&]:hover:bg-[#1a3158]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
