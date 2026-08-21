import * as React from "react";

/**
 * Boş durum: ne olduğunu söyleyen tek cümle ve tek bir sonraki adım.
 * İllüstrasyon, büyük ikon dairesi ya da emoji yok (bkz. DESIGN.md).
 */
export function EmptyState({
  title,
  description,
  action,
  inset = true,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Kendi kartı içinde mi çizilsin, yoksa sayfaya mı otursun. */
  inset?: boolean;
}) {
  const content = (
    <>
      <h2 className="t-subhead" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
      {description && (
        <p className="mt-2 max-w-[60ch] t-body" style={{ color: "var(--ink-2)" }}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </>
  );

  if (!inset) return <div>{content}</div>;

  return (
    <section
      className="rounded-[var(--radius-lg)] p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      {content}
    </section>
  );
}

export default EmptyState;
