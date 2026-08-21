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
 * Dolgu, veri mavisinden bir tık koyu olan --accent-solid'i kullanır: parlak
 * mavi üzerinde beyaz metin 3.5:1'de kalıyordu, bu tonda 4.7:1 veriyor.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
    "transition-colors duration-fast ease-out-quart " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-[var(--canvas)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent-solid)] text-[var(--on-accent)] shadow-button hover:bg-[var(--accent)] active:bg-[var(--accent-press)]",
        destructive: "bg-[var(--error)] text-[var(--canvas)] hover:opacity-90",
        outline:
          "border border-[var(--line-strong)] text-[var(--ink)] bg-transparent hover:bg-[var(--surface-2)] hover:border-[var(--ink-3)]",
        secondary:
          "bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--surface-3)]",
        ghost: "text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
        soft: "bg-[var(--accent-quiet)] text-[var(--accent-ink)] hover:bg-[var(--accent-faint)]",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        default: "h-10 px-4 text-base",
        lg: "h-11 px-5 text-base",
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
