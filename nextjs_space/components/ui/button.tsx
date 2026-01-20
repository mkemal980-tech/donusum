import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary hover:shadow-primary-lg hover:-translate-y-0.5",
        destructive:
          "bg-gradient-to-r from-error-500 to-error-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5",
        outline:
          "border-2 border-primary-500 text-primary-600 bg-transparent hover:bg-primary-500 hover:text-white",
        secondary:
          "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5",
        ghost: "text-primary-600 hover:bg-primary-50",
        link: "text-primary-500 underline-offset-4 hover:underline",
        soft: "bg-primary-50 text-primary-600 hover:bg-primary-100",
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
