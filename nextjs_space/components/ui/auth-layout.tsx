import Link from "next/link";

/**
 * Giriş ve kayıt ekranlarının ortak iskeleti.
 *
 * İki sütun: solda form (tek sütun, 400px'i geçmez — form alanları uzadıkça
 * göz hattı kaymasın), sağda ürünün ne yaptığını söyleyen sessiz panel.
 * Sağ panel örnek veri göstermez; gerçek olmayan sayı, kullanıcı adı veya
 * grafik koymuyoruz.
 *
 * Panel yalnızca lg üstünde çizilir; dar ekranda form tüm genişliği alır.
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* --- Form sütunu --- */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 self-start" aria-label="Ana sayfa">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)] text-[13px] font-semibold"
            style={{ background: "var(--accent-solid)", color: "var(--on-accent)" }}
          >
            DP
          </span>
          <span className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
            Dönüşüm Platformu
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            <h1 className="t-title" style={{ color: "var(--ink)" }}>
              {title}
            </h1>
            <p className="mt-1.5 t-body" style={{ color: "var(--ink-2)" }}>
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>

            <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--line)" }}>
              {footer}
            </div>
          </div>
        </div>
      </div>

      {/* --- Anlatı paneli --- */}
      <aside
        className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between"
        style={{ background: "var(--rail)", borderLeft: "1px solid var(--line)" }}
      >
        {/* Ölçüm ızgarası: dekoratif değil, panonun kendi grafik dilinden bir iz. */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <pattern id="auth-grid" width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M64 0H0v64" fill="none" stroke="var(--line)" strokeWidth="1" strokeOpacity="0.55" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
        </svg>

        <div className="relative px-12 pt-16">
          <p className="t-caption">Kurumsal olgunluk değerlendirmesi</p>
          <p
            className="mt-5 max-w-[22ch] text-[34px] font-semibold leading-[1.15]"
            style={{ color: "var(--ink)", letterSpacing: "-0.025em" }}
          >
            Ölç, kıyasla, sıradaki adımı seç.
          </p>
        </div>

        <ol className="relative flex flex-col gap-0 px-12 pb-16">
          {[
            { n: "01", t: "Ölçüm", d: "Anket bölüm bölüm doldurulur, her birim kendi alanından sorumludur." },
            { n: "02", t: "Kıyaslama", d: "Kurumsal puan kategori kırılımıyla ve sektör ortalamasıyla karşılaştırılır." },
            { n: "03", t: "Yol haritası", d: "Zayıf kategoriler önceliklendirilmiş eylem listesine dönüşür." },
          ].map((step) => (
            <li key={step.n} className="flex gap-5 py-5" style={{ borderTop: "1px solid var(--line)" }}>
              <span
                className="pt-0.5 text-[13px] font-medium tabular"
                style={{ color: "var(--accent)" }}
                aria-hidden="true"
              >
                {step.n}
              </span>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                  {step.t}
                </p>
                <p className="mt-1 max-w-[46ch] t-sm" style={{ color: "var(--ink-2)" }}>
                  {step.d}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
