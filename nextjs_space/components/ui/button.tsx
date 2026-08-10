import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Uygulamanın tek buton kaynağı.
 *
 * Buton görünüşü önceden her ekranda elle yazılıyordu ("px-4 py-2 bg-accent
 * text-white rounded-lg hover:..."): renkler token'dan geldiği için tutarlıydı
 * ama dolgu, köşe, hover ve disabled davranışı sayfadan sayfaya kayıyordu ve
 * bir ölçüyü değiştirmek için tek bir dosya yoktu.
 *
 * Dolgu turkuaz üzerine koyu metin kullanır: beyaz metnin kontrastı 2.2:1 ile
 * WCAG'in 4.5:1 eşiğinin çok altında kalıyor, koyu metin 8.1:1 veriyor.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-[var(--bg-main)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[var(--bg-deep)] hover:bg-[var(--accent-dark)]",
        destructive: "bg-[var(--error)] text-white hover:opacity-90",
        outline:
          "border border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[rgba(12,193,195,0.1)]",
        secondary:
          "bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:text-[var(--text-main)]",
        ghost: "text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text-main)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
        soft: "bg-[rgba(12,193,195,0.1)] text-[var(--accent)] hover:bg-[rgba(12,193,195,0.2)]",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9",
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
  /** Beklerken dönen simge gösterir ve butonu kilitler. */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    // `asChild` ile sarmalanan öğeye ekstra düğüm eklenemez; yükleme
    // göstergesi yalnızca gerçek butonda anlamlı.
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
