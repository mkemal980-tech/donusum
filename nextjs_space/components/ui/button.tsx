import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[var(--bg-deep)] shadow-md hover:bg-[var(--accent-bright)] hover:-translate-y-0.5",
        destructive:
          "bg-[var(--error)] text-white shadow-md hover:opacity-90 hover:-translate-y-0.5",
        outline:
          "border-2 border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)] hover:text-[var(--bg-deep)]",
        secondary:
          "bg-[var(--blue-main)] text-white shadow-md hover:bg-[var(--blue-dark)] hover:-translate-y-0.5",
        ghost: "text-[var(--accent)] hover:bg-[rgba(12,193,195,0.1)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
        soft: "bg-[rgba(12,193,195,0.1)] text-[var(--accent)] hover:bg-[rgba(12,193,195,0.2)]",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
