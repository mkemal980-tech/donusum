import * as React from "react";

/**
 * Kart yüzeyi. Gölge yok; ayrışma --surface / --canvas kontrastı ve 1px
 * kenarlıkla olur (bkz. DESIGN.md > Elevation).
 *
 * İç içe kullanılmaz: kart içinde ayrı bir blok gerekiyorsa `--surface-2`
 * zeminli, kenarlıksız bir div yeterlidir.
 */
export function Panel({
  title,
  description,
  actions,
  padding = "md",
  className = "",
  children,
  ...rest
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** `none` tabloların kenara dayanması gerektiğinde kullanılır. */
  padding?: "none" | "sm" | "md";
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-4" : "p-6";
  const headerPad = padding === "none" ? "px-6 pt-6" : "";

  return (
    <section
      className={`rounded-[var(--radius-lg)] ${pad} ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      {...rest}
    >
      {(title || actions) && (
        <div className={`flex flex-wrap items-baseline justify-between gap-3 ${headerPad}`}>
          <div className="min-w-0">
            {title && (
              <h2 className="t-subhead" style={{ color: "var(--ink)" }}>
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {(title || actions) ? <div className={padding === "none" ? "mt-4" : "mt-5"}>{children}</div> : children}
    </section>
  );
}

export default Panel;
