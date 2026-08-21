import * as React from "react";

/**
 * Sayfa başlığı — giriş sonrası her ekranın ilk bloğu.
 *
 * Başlık, tek satır bağlam ve sağda eylemler. İkon taşımaz: sol menüde zaten
 * sayfanın ikonu var, başlıkta tekrarı hiyerarşiyi değil gürültüyü artırıyor.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="t-display" style={{ color: "var(--ink)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
