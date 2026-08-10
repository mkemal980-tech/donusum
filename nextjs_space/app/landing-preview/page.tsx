import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gauge,
  Globe2,
  Layers,
  LineChart,
  Lightbulb,
  Map,
  ShieldCheck,
  Users,
} from "lucide-react";

/**
 * Tanıtım sayfası taslağı (onay için).
 *
 * Yapı Payoneer'ın kurumsal iniş sayfasından alındı: sabit üst bar, tek
 * çağrılı hero + ürün görseli, güven şeridi, altılı çözüm ızgarası, sayı
 * bandı, üçlü segment, referanslar, kaynaklar, kapanış çağrısı ve geniş
 * footer. Görsel dil tamamen ESG LAB: turuncu vurgu, lacivert mürekkep,
 * gradyansız düz yüzeyler, Space Grotesk başlık + IBM Plex gövde.
 *
 * Sayfa yalnızca token kullanır; tek bir sabit renk yoktur.
 */

const solutions = [
  {
    icon: ClipboardList,
    title: "Olgunluk değerlendirmesi",
    text: "Sektöre göre ağırlıklandırılmış anketlerle kurumunuzun bugünkü yerini ölçün.",
  },
  {
    icon: BarChart3,
    title: "Sektörel kıyaslama",
    text: "Puanınızı kendi sektörünüzün ortalaması ve en iyisiyle karşılaştırın.",
  },
  {
    icon: Lightbulb,
    title: "Öneri motoru",
    text: "Her cevaba bağlı, sıradaki adımı gösteren kademeli iyileştirme önerileri.",
  },
  {
    icon: Map,
    title: "Dönüşüm yol haritası",
    text: "Önerileri vade, maliyet ve etkiye göre planlayın, ilerlemeyi takip edin.",
  },
  {
    icon: Building2,
    title: "Birim ve tedarikçi takibi",
    text: "Her birimi ayrı değerlendirin, kanıt belgeleriyle birlikte tek panodan izleyin.",
  },
  {
    icon: FileText,
    title: "Raporlama",
    text: "Yönetim kurulu sunumuna hazır PDF ve Excel çıktıları, tek tıkla.",
  },
];

const stats = [
  { value: "284", label: "hazır iyileştirme önerisi" },
  { value: "22", label: "NACE sektör kapsamı" },
  { value: "5", label: "olgunluk basamağı" },
  { value: "%100", label: "kanıta dayalı puanlama" },
];

const values = [
  {
    icon: Gauge,
    title: "Ölçülebilir ilerleme",
    text: "Puan tek bir sayı değil; kategori kategori nerede durduğunuzu ve neyin ne kadar katkı yapacağını gösterir.",
  },
  {
    icon: ShieldCheck,
    title: "Kanıtla desteklenen beyan",
    text: "Her cevaba belge iliştirilir. Denetime girdiğinizde iddia değil, dosya konuşur.",
  },
  {
    icon: Globe2,
    title: "Sektöre göre kapsam",
    text: "Kurumunuzu ilgilendirmeyen bölümler sorulmaz, puana da girmez.",
  },
];

const segments = [
  {
    icon: Users,
    title: "Kurumsal ekipler",
    text: "Bölümleri sorumlulara dağıtın, tek kurumsal puanda birleştirin.",
    href: "/signup",
  },
  {
    icon: Layers,
    title: "Tedarikçiler",
    text: "Alıcınızın istediği olgunluk beyanını kanıtlarıyla birlikte hazırlayın.",
    href: "/signup",
  },
  {
    icon: LineChart,
    title: "Danışmanlar",
    text: "Müşteri portföyünüzü tek panodan yönetin, ilerlemeyi raporlayın.",
    href: "/signup",
  },
];

const testimonials = [
  {
    quote:
      "Anketi doldurduktan sonra elimizde bir puan değil, sırayla yapılacak işler listesi vardı. Fark bu.",
    name: "Sürdürülebilirlik Müdürü",
    org: "Tersane · 1.200 çalışan",
  },
  {
    quote:
      "Tedarikçilerimizden gelen beyanları ilk kez aynı ölçekte karşılaştırabildik.",
    name: "Satın Alma Direktörü",
    org: "Otomotiv yan sanayi",
  },
  {
    quote:
      "Kategori kıyaslaması yönetim kuruluna gitmeden önceki en zor sorumuzu cevapladı: sektöre göre neredeyiz?",
    name: "Genel Müdür Yardımcısı",
    org: "Kimya · ihracatçı",
  },
];

const resources = [
  {
    tag: "REHBER",
    title: "Kapsam 1-2 emisyon envanterine nereden başlanır?",
    text: "Sabit ve hareketli yakıt kaynaklarını tek takvimde toplamanın pratik yolu.",
  },
  {
    tag: "ANALİZ",
    title: "CBAM öncesi tedarik zinciri hazırlığı",
    text: "Sınırda karbon düzenlemesi için hangi verinin ne zaman gerektiği.",
  },
  {
    tag: "VAKA",
    title: "Bir tersanenin 284 önerilik dönüşüm planı",
    text: "Belgeden üretilmiş öneri merdiveninin sahada nasıl kurulduğu.",
  },
];

export default function LandingPreviewPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* ===== Üst bar ===== */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-soft)] bg-[var(--bg-card)]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1220px] items-center gap-8 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--text-main)]">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              ESG <span className="text-[var(--accent)]">LAB</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-[var(--text-muted)] lg:flex">
            {["Çözümler", "Sektörler", "Kaynaklar", "Fiyatlandırma"].map((item) => (
              <span key={item} className="cursor-default hover:text-[var(--text-main)]">
                {item}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-lg px-4 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] sm:inline-flex"
            >
              Giriş yap
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] hover:bg-[var(--accent-dark)]"
            >
              Hesap oluştur
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="border-b border-[var(--border-soft)]">
        <div className="mx-auto grid max-w-[1220px] items-center gap-14 px-6 py-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
              Sürdürülebilirlik olgunluk platformu
            </span>
            <h1 className="mt-5 text-[clamp(2.2rem,4.4vw,3.4rem)] font-semibold leading-[1.08] tracking-tight">
              Sürdürülebilirlik dönüşümü,
              <br />
              ölçülebilir bir plana dönüşsün
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[var(--text-muted)]">
              Kurumunuzun bugünkü olgunluğunu ölçün, sektörünüzle kıyaslayın ve sıradaki adımı
              gösteren bir yol haritasıyla ilerleyin — hepsi tek platformda.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-base font-medium text-[var(--on-accent)] hover:bg-[var(--accent-dark)]"
              >
                Değerlendirmeye başla <ArrowRight size={18} />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-[var(--ui-passive)] px-6 text-base font-medium hover:bg-[var(--bg-card-2)]"
              >
                Demo anketi gör
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]">
              {["Kurulum gerektirmez", "Sektöre göre ağırlıklı puan", "Kanıt yükleme dahil"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[var(--accent)]" />
                    {item}
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Ürün görseli — gerçek panonun sadeleştirilmiş hâli */}
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-md)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim)]">
                  Genel olgunluk
                </p>
                <p className="mt-1 font-mono text-4xl font-semibold">3.4</p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                Gelişen
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {[
                ["Enerji ve karbon yönetimi", 82],
                ["İklim geçişi ve eko-tasarım", 61],
                ["Kirlilik, kimyasallar ve atık", 48],
                ["Su ve biyoçeşitlilik", 39],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-[var(--text-muted)]">{label}</span>
                    <span className="font-mono text-[var(--text-main)]">{value}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-card-2)]">
                    <div
                      className="h-1.5 rounded-full bg-[var(--accent)]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[var(--border-soft)] pt-4 text-sm">
              <span className="text-[var(--text-dim)]">Sıradaki adım</span>
              <span className="font-medium">Kapsam 1-2 envanterini kurun</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Güven şeridi ===== */}
      <section className="border-b border-[var(--border-soft)] bg-[var(--bg-card)]">
        <div className="mx-auto max-w-[1220px] px-6 py-10">
          <p className="text-center font-mono text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
            Sanayi, denizcilik ve ihracat kuruluşları tarafından kullanılıyor
          </p>
          <div className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {["TERSANE A.Ş.", "METALSAN", "EGE KİMYA", "DENİZ LOJİSTİK", "ANADOLU TEKSTİL", "PORT GRUP"].map(
              (name) => (
                <span
                  key={name}
                  className="text-center font-mono text-sm tracking-tight text-[var(--text-dim)]"
                >
                  {name}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ===== Çözümler ===== */}
      <section className="mx-auto max-w-[1220px] px-6 py-20">
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
            Çözümler
          </span>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight">
            Değerlendirmeden uygulamaya tek akış
          </h2>
          <p className="mt-4 text-lg text-[var(--text-muted)]">
            Anketi doldurun, puanı görün, önerileri planlayın. Her adım bir öncekinin çıktısını
            kullanır; hiçbir veriyi iki kez girmezsiniz.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {solutions.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 transition-colors hover:border-[var(--ui-passive)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon size={20} />
              </span>
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-[var(--text-muted)]">{text}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
                Daha fazlası <ArrowRight size={15} />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Sayı bandı ===== */}
      <section className="border-y border-[var(--border-soft)] bg-[var(--bg-card)]">
        <div className="mx-auto grid max-w-[1220px] gap-8 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="font-mono text-4xl font-semibold text-[var(--accent)]">{value}</p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Değer önerileri ===== */}
      <section className="mx-auto max-w-[1220px] px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-3">
          {values.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon size={22} className="text-[var(--accent)]" />
              <h3 className="mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-[var(--text-muted)]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Segmentler ===== */}
      <section className="border-y border-[var(--border-soft)] bg-[var(--bg-card)]">
        <div className="mx-auto max-w-[1220px] px-6 py-20">
          <h2 className="text-4xl font-semibold tracking-tight">Kimler kullanıyor?</h2>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {segments.map(({ icon: Icon, title, text, href }) => (
              <Link
                key={title}
                href={href}
                className="rounded-2xl border border-[var(--border-soft)] p-6 transition-colors hover:border-[var(--accent)]"
              >
                <Icon size={22} className="text-[var(--accent)]" />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-[var(--text-muted)]">{text}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
                  Daha fazlası <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Referanslar ===== */}
      <section className="mx-auto max-w-[1220px] px-6 py-20">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
          Referanslar
        </span>
        <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight">
          Kurumlar puanı değil, sıradaki adımı konuşuyor
        </h2>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {testimonials.map(({ quote, name, org }) => (
            <figure
              key={name}
              className="flex h-full flex-col rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-6"
            >
              <blockquote className="text-lg leading-snug">“{quote}”</blockquote>
              <figcaption className="mt-auto pt-6 text-sm">
                <span className="block font-medium">{name}</span>
                <span className="text-[var(--text-dim)]">{org}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ===== Kaynaklar ===== */}
      <section className="border-y border-[var(--border-soft)] bg-[var(--bg-card)]">
        <div className="mx-auto max-w-[1220px] px-6 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl font-semibold tracking-tight">Kaynaklar</h2>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
              Tümünü gör <ArrowRight size={15} />
            </span>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {resources.map(({ tag, title, text }) => (
              <article
                key={title}
                className="overflow-hidden rounded-2xl border border-[var(--border-soft)]"
              >
                <div className="h-36 bg-[var(--bg-card-2)]" />
                <div className="p-6">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim)]">
                    {tag}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold leading-snug">{title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Kapanış çağrısı ===== */}
      <section className="mx-auto max-w-[1220px] px-6 py-20">
        <div className="rounded-2xl bg-[var(--text-main)] px-8 py-14 text-center text-[var(--bg-card)]">
          <h2 className="text-4xl font-semibold tracking-tight text-inherit">
            Kurumunuz bugün nerede?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">
            Demo anketi 12 dakikada tamamlanır ve size gerçek bir olgunluk puanı ile ilk üç
            iyileştirme adımını verir.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-base font-medium text-[var(--on-accent)] hover:bg-[var(--accent-dark)]"
          >
            Ücretsiz başlayın <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-[var(--border-soft)] bg-[var(--bg-card)]">
        <div className="mx-auto max-w-[1220px] px-6 py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--text-main)]">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  ESG <span className="text-[var(--accent)]">LAB</span>
                </span>
              </div>
              <p className="mt-4 max-w-sm text-sm text-[var(--text-muted)]">
                Sürdürülebilirlik ve dijital olgunluk değerlendirmesi, sektörel kıyaslama ve
                dönüşüm yol haritası platformu.
              </p>
            </div>

            {[
              { title: "Çözümler", items: ["Olgunluk değerlendirmesi", "Kıyaslama", "Yol haritası", "Raporlama"] },
              { title: "Kurumsal", items: ["Hakkımızda", "Kaynaklar", "İletişim", "Kariyer"] },
              { title: "Destek", items: ["Yardım merkezi", "KVKK", "Gizlilik", "Kullanım şartları"] },
            ].map(({ title, items }) => (
              <div key={title}>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-dim)]">
                  {title}
                </p>
                <ul className="mt-4 space-y-2.5 text-sm text-[var(--text-muted)]">
                  {items.map((item) => (
                    <li key={item} className="cursor-default hover:text-[var(--text-main)]">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-soft)] pt-6 text-sm text-[var(--text-dim)]">
            <span>© 2026 ESG LAB. Tüm hakları saklıdır.</span>
            <span className="font-mono text-xs">KVKK · ISO 27001 · TSE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
