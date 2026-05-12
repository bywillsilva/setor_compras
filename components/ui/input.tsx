import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-9 w-full min-w-0 rounded-xl border bg-white/88 px-3 py-1 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-18px_rgba(14,33,72,0.65)] transition-[color,box-shadow,border-color,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_12px_30px_-24px_rgba(0,0,0,0.7)] md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'hover:border-primary/30 focus-visible:bg-white dark:hover:border-primary/35 dark:focus-visible:bg-card',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export { Input }
