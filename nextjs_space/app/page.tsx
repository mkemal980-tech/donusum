import Link from "next/link";
import "./landing.css";

/**
 * Tanıtım (açılış) sayfası — ESG Akademi "blueprint" tasarım dili.
 *
 * Görsel dil ve metin, onaylanan tasarım dosyasından birebir taşındı:
 * Barlow Condensed büyük harf başlıklar, ince çizgili blueprint çerçeveler,
 * açık gri zemin ve lacivert bantlar. Stiller app/landing.css'te ve
 * `.esg-landing` altında kapsanmıştır — sınıf adları uygulamanınkilerle
 * çakışıyor, kapsamsız kalsalar panoyu da boyarlardı.
 *
 * Sayfa uygulamanın tema token'larını kullanmaz; kendi paletini taşır,
 * böylece koyu tema seçen kullanıcıda da marka görünümüyle açılır.
 */

const featureIcon = {
  stroke: "var(--color-accent-700)",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
};

const features = [
  {
    title: "Olgunluk Analizi",
    text: "Kapsamlı anketlerle mevcut seviyenizi 1–5 ölçeğinde ölçün, boyut bazında kırılımı görün.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" {...featureIcon}>
        <line x1="4" y1="20" x2="4" y2="10" />
        <line x1="10" y1="20" x2="10" y2="4" />
        <line x1="16" y1="20" x2="16" y2="13" />
        <line x1="22" y1="20" x2="2" y2="20" />
      </svg>
    ),
  },
  {
    title: "Sektörel Kıyaslama",
    text: "Skorunuzu sektör ortalaması ve en iyi uygulamalarla yan yana görün; nerede olduğunuzu bilin.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" {...featureIcon}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    title: "Akıllı Öneriler",
    text: "Puanlarınıza göre kişiselleştirilmiş stratejik öneriler; her biri somut aksiyon adımlarıyla.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" {...featureIcon}>
        <path d="M9 18h6" />
        <path d="M10 21h4" />
        <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z" />
      </svg>
    ),
  },
  {
    title: "Yol Haritası",
    text: "Önerileri çeyreklere dağıtın, stratejik planınızı oluşturun ve ilerlemenizi takip edin.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" {...featureIcon}>
        <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
        <line x1="9" y1="4" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="20" />
      </svg>
    ),
  },
  {
    title: "İlerleme Takibi",
    text: "Geçmiş skorlarınızı karşılaştırın, zaman içindeki gelişiminizi ve trendleri analiz edin.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" {...featureIcon}>
        <polyline points="3 17 9 11 13 15 21 7" />
        <polyline points="15 7 21 7 21 13" />
      </svg>
    ),
  },
  {
    title: "Hız–Dayanıklılık Analizi",
    text: "Hız ve dayanıklılık eksenlerinde konumunuzu görün: Sprinter mi, Maratoncu mu, Iron Man mi?",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" {...featureIcon}>
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="17" cy="7" r="2.5" />
      </svg>
    ),
  },
];

const scores = [
  { label: "Çevresel", value: "3.8", width: "76%" },
  { label: "Sosyal", value: "3.1", width: "62%" },
  { label: "Yönetişim", value: "3.3", width: "66%" },
  { label: "Dijital", value: "2.7", width: "54%" },
];

const stats = [
  { value: "500+", label: "Katılımcı kurum" },
  { value: "2", label: "Değerlendirme alanı" },
  { value: "12", label: "Sektör kıyası" },
  { value: "5", label: "Olgunluk seviyesi" },
];

const whyIcon = { ...featureIcon };

const reasons = [
  {
    title: "Güvenilir metodoloji",
    text: "Sektör standartlarına dayalı objektif ölçüm; ağırlıklı puanlama ve kanıt talebi.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...whyIcon}>
        <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    title: "Sektörel kıyas",
    text: "Aynı sektördeki kurumlarla karşılaştırma; NACE kodlu sektör ve alt sektör eşleşmesi.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...whyIcon}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <circle cx="17" cy="6" r="2" />
        <path d="M17 11c2.2 0 4 1.8 4 4" />
      </svg>
    ),
  },
  {
    title: "Hızlı sonuç",
    text: "Anket tamamlandığı anda analiz, kıyas ve öneriler hazır — beklemek yok.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...whyIcon}>
        <polygon points="13 2 5 14 11 14 9 22 19 9 13 9" />
      </svg>
    ),
  },
  {
    title: "Kapsamlı perspektif",
    text: "ESG'den dijitale, tüm iş alanlarını kapsayan bütünsel değerlendirme.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...whyIcon}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
      </svg>
    ),
  },
  {
    title: "Birim bazlı yönetim",
    text: "Birimlerinize anket atayın, tamamlanmayı izleyin, kurum genelinde konsolide skor alın.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...whyIcon}>
        <rect x="3" y="4" width="18" height="14" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="21" x2="16" y2="21" />
      </svg>
    ),
  },
  {
    title: "Uzman desteği",
    text: "ESG Akademi eğitim kadrosu her adımda yanınızda; eğitim ve danışmanlıkla entegre.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" {...whyIcon}>
        <path d="M14 9V5a2 2 0 0 0-2-2l-3 7v11h9.3a2 2 0 0 0 2-1.7l1.2-7a2 2 0 0 0-2-2.3z" />
        <path d="M9 21H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h3" />
      </svg>
    ),
  },
];

const audiences = [
  {
    title: "KOBİ'ler",
    text: "Tedarik zincirlerinin ESG beklentileri hızla artıyor. Olgunluğunuzu ölçün, eksiklerinizi önceliklendirin ve müşterilerinize kanıtlanabilir bir dönüşüm hikâyesi sunun.",
    caption: "KOBİ görseli",
    imageFirst: true,
  },
  {
    title: "Kurumsal gruplar",
    text: "Birden çok birim ve iştirakte anket atayın, tamamlanmayı tek panelden izleyin. Konsolide skorlar ve birim kıyasları raporlama döneminizi kısaltır.",
    caption: "Kurumsal grup görseli",
    imageFirst: false,
  },
  {
    title: "Danışmanlar ve eğitmenler",
    text: "Müşterilerinizin mevcut durumunu standart bir metodolojiyle tespit edin; öneri kütüphanesini kendi danışmanlık sürecinize temel yapın.",
    caption: "Danışmanlık görseli",
    imageFirst: true,
  },
];

const resources = [
  {
    title: "ESG raporlama rehberi: nereden başlamalı?",
    text: "CSRD ve TSRS sonrası raporlama beklentileri ve olgunlukla ilişkisi.",
  },
  {
    title: "Dijital olgunluk nedir, nasıl ölçülür?",
    text: "Veri, bulut, otomasyon ve siber güvenlik eksenlerinde 5 seviye.",
  },
  {
    title: "Karbon ayak izi 101: Kapsam 1-2-3",
    text: "Ölçümden doğrulamaya temel kavramlar ve ilk adım planı.",
  },
];

const footerColumns = [
  {
    title: "Çözümler",
    items: ["Sürdürülebilirlik Anketi", "Dijital Dönüşüm Anketi", "Kurumsal Paketler"],
  },
  { title: "Platform", items: ["Nasıl çalışır", "Fiyatlandırma", "Örnek rapor", "SSS"] },
  { title: "Kurum", items: ["Hakkımızda", "Eğitimler", "İletişim", "Kariyer"] },
  {
    title: "Destek",
    items: ["Yardım merkezi", "KVKK", "Gizlilik politikası", "Çerez politikası"],
  },
];

/** Blueprint çerçevesinin dört köşe işareti. */
function Corners() {
  return (
    <>
      <i className="corner tl" aria-hidden />
      <i className="corner tr" aria-hidden />
      <i className="corner bl" aria-hidden />
      <i className="corner br" aria-hidden />
    </>
  );
}

export default function LandingPage() {
  return (
    <div className="esg-landing">
      <div className="shell">
        {/* ===== Üst çubuk ===== */}
        <div className="topline">
          <a href="#kaynaklar">Kaynaklar</a>
          <a href="#neden">Hakkımızda</a>
          <span>
            <b>TR</b>{" "}
            <span style={{ color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>
              / EN
            </span>
          </span>
        </div>

        <nav className="nav">
          <span className="brand">
            ESG Akademi <span>/ Anket</span>
          </span>
          <div className="nav-links">
            <a href="#cozumler">Sürdürülebilirlik</a>
            <a href="#cozumler">Dijital Dönüşüm</a>
            <a href="#kimler">Kurumsal</a>
            <a href="#kaynaklar">Fiyatlandırma</a>
          </div>
          <div className="nav-actions">
            <Link href="/login" style={{ fontSize: 14, fontWeight: 500 }}>
              Giriş Yap
            </Link>
            <Link href="/signup" className="btn btn-primary">
              Kayıt Ol
            </Link>
          </div>
        </nav>

        {/* ===== Hero ===== */}
        <div className="band-dark on-dark">
          <div className="hero">
            <div>
              <h1>Kurumsal dönüşüm ölçümü basitleşti</h1>
              <p className="hero-lede">
                Sürdürülebilirlik ve dijital olgunluğunuzu tek platformda ölçün, sektörünüzle
                kıyaslayın ve stratejik önerilerle büyüyün.
              </p>
              <div className="hero-actions">
                {/* Oturumu olan doğrudan panoya girer; olmayanı /dashboard
                    kendisi /login'e yönlendirir. */}
                <Link href="/dashboard" className="btn btn-primary btn-lg">
                  Ankete Başla
                </Link>
                <Link href="/signup" className="btn btn-secondary btn-lg">
                  Örnek raporu inceleyin
                </Link>
              </div>
            </div>

            <div className="blueprint score-card">
              <Corners />
              <div className="score-head">
                <span className="kicker">Olgunluk raporu</span>
                <span className="tag-outline">Örnek</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
                <span className="score-value">3.4</span>
                <span
                  style={{
                    fontSize: 13,
                    color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
                  }}
                >
                  / 5 genel olgunluk · sektör ort. 2.9
                </span>
              </div>
              <div className="bars">
                {scores.map((score) => (
                  <div key={score.label}>
                    <div className="bar-label">
                      <span>{score.label}</span>
                      <span>{score.value}</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: score.width }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== Güven şeridi ===== */}
        <div className="trust">
          <div className="trust-label">
            Türkiye&apos;nin önde gelen kurumlarının güvendiği platform
          </div>
          <div className="trust-logos">
            {["TERSA", "AKSU ENERJİ", "MERİDYEN", "KARTAL LOJİSTİK", "NOVA TEKSTİL", "EGE KİMYA"].map(
              (name) => (
                <span key={name}>{name}</span>
              )
            )}
          </div>
        </div>

        {/* ===== Çözümler ===== */}
        <div className="section" id="cozumler">
          <h2 style={{ fontSize: 40, textAlign: "center" }}>Dönüşümünüzü büyütmek için her şey</h2>
          <p className="section-lede">Ölçümden yol haritasına, tek hesapta.</p>
          <div className="grid-3">
            {features.map((feature) => (
              <div key={feature.title} className="blueprint feature">
                <Corners />
                {feature.icon}
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <a className="more" href="#kimler">
                  Daha fazla →
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Tanıtım videosu ===== */}
        <div style={{ padding: "0 var(--gutter) 72px", textAlign: "center" }}>
          <div className="kicker">Platformla tanışın</div>
          <h2 style={{ fontSize: 36, marginTop: 12 }}>Size sunacak çok şeyimiz var</h2>
          <figure className="blueprint" style={{ margin: "36px auto 0", maxWidth: 760 }}>
            <div className="shot shot-16x9">Tanıtım videosu</div>
            <Corners />
            <span className="play" aria-hidden>
              <span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-bg)">
                  <polygon points="7,4 20,12 7,20" />
                </svg>
              </span>
            </span>
          </figure>
        </div>

        {/* ===== Sayı bandı ===== */}
        <div className="stats">
          {stats.map((stat) => (
            <div key={stat.label} className="stat">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ===== Neden biz ===== */}
        <div className="section" id="neden">
          <h2 style={{ fontSize: 36, textAlign: "center" }}>Neden ESG Akademi Anket?</h2>
          <p className="section-lede">
            Kurumsal dönüşüm ölçümü karmaşıklaşabilir; biz basitleştirmeyi görev edindik.
          </p>
          <div className="grid-why">
            {reasons.map((reason) => (
              <div key={reason.title} className="why">
                {reason.icon}
                <div>
                  <h4>{reason.title}</h4>
                  <p>{reason.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Kimler kullanıyor ===== */}
        <div className="section section-bordered" id="kimler">
          <h2 style={{ fontSize: 36, textAlign: "center" }}>Kimler kullanıyor?</h2>
          {audiences.map((audience) => {
            const image = (
              <figure className="blueprint" style={{ margin: 0 }}>
                <div className="shot shot-8x5">{audience.caption}</div>
                <Corners />
              </figure>
            );
            const copy = (
              <div>
                <h3>{audience.title}</h3>
                <p>{audience.text}</p>
                <a className="more" href="#kaynaklar">
                  Daha fazla →
                </a>
              </div>
            );
            return (
              <div key={audience.title} className="split">
                {audience.imageFirst ? image : copy}
                {audience.imageFirst ? copy : image}
              </div>
            );
          })}
        </div>

        {/* ===== Başarı hikâyesi ===== */}
        <div className="section section-bordered">
          <h2 style={{ fontSize: 36, textAlign: "center" }}>Başarı hikâyeleri</h2>
          <div className="quote-row">
            <div>
              <blockquote>
                “Anketi iki haftada tüm birimlerimizle tamamladık; çıkan yol haritası yönetim
                kurulu sunumumuzun omurgası oldu. Nerede olduğumuzu ilk kez sayılarla
                konuşabildik.”
              </blockquote>
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Elif Demir</div>
                <div
                  style={{
                    fontSize: 14,
                    color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
                  }}
                >
                  Sürdürülebilirlik Direktörü, Nova Tekstil
                </div>
                <span className="tag-outline" style={{ marginTop: 8 }}>
                  Tekstil · Türkiye
                </span>
              </div>
              <div className="dots" aria-hidden>
                <i className="on" />
                <i />
                <i />
              </div>
            </div>
            <figure className="blueprint" style={{ margin: 0 }}>
              <div className="shot shot-4x3">Müşteri fotoğrafı</div>
              <Corners />
            </figure>
          </div>
        </div>

        {/* ===== Kaynaklar ===== */}
        <div className="section section-bordered" id="kaynaklar">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="kicker">Kaynak merkezi</div>
              <h2 style={{ fontSize: 36, marginTop: 12 }}>Kaynak merkezimizi ziyaret edin</h2>
            </div>
            <Link href="/signup" className="btn btn-secondary">
              Keşfetmeye başlayın
            </Link>
          </div>

          <div className="grid-3" style={{ marginTop: 44 }}>
            {resources.map((resource) => (
              <div key={resource.title} className="blueprint resource">
                <Corners />
                <div className="shot shot-card">Yazı görseli</div>
                <div style={{ padding: 20 }}>
                  <h3>{resource.title}</h3>
                  <p>{resource.text}</p>
                  <a className="more" href="#kaynaklar">
                    Devamını oku →
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="disclaimer">
            Skorlar kurumların öz-değerlendirme beyanlarına dayanır; sektör kıyasları platformdaki
            katılımcı verilerinden anonim olarak üretilir. Sonuçlar bağımsız denetim veya
            sertifikasyon yerine geçmez.
          </p>
        </div>

        {/* ===== Footer ===== */}
        <div className="band-dark on-dark footer">
          <div className="footer-grid">
            <div>
              <div className="brand" style={{ color: "var(--color-bg)" }}>
                ESG Akademi / Anket
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: "20px",
                  marginTop: 12,
                  maxWidth: "30ch",
                  color: "color-mix(in srgb, var(--color-bg) 65%, transparent)",
                }}
              >
                Sürdürülebilirlik ve dijital olgunluk ölçümü, tek platformda.
              </p>
              <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: 20 }}>
                Ankete Başla
              </Link>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <h5>{column.title}</h5>
                <div className="footer-links">
                  {column.items.map((item) => (
                    <a key={item} href="#kaynaklar">
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="footer-bottom">
            <span>© 2026 ESG Akademi. Tüm hakları saklıdır.</span>
            <span style={{ display: "flex", gap: 18 }}>
              <a href="#kaynaklar">X</a>
              <a href="#kaynaklar">LinkedIn</a>
              <a href="#kaynaklar">YouTube</a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
