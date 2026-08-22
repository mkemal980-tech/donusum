/* eslint-disable @next/next/no-img-element --
   next.config.js'te images.unoptimized = true; next/image bu projede
   optimizasyon yapmıyor, yalnızca fazladan sarmalayıcı ekliyor. */
import Link from "next/link";
import LandingTransformationLens from "@/components/landing/landing-transformation-lens";
import "./landing.css";

/**
 * Tanıtım (açılış) sayfası — monokrom, düz yüzeyli tasarım dili.
 *
 * Görsel dil: siyah zemin, beyaz birincil ve gri ikincil metin, Inter,
 * sıkı harf aralıklı büyük başlıklar, bölümleri ayıran 1px hairline
 * çizgiler, küçük yarıçap ve bol dikey boşluk. Gölge, degrade ve renkli
 * vurgu yok; hero'daki optik mercek, ürün verisini keşfetmek için bilinçli
 * tek hareketli istisnadır. Stiller app/landing.css'te ve `.esg-landing` altında
 * kapsanmıştır — sınıf adları uygulamanınkilerle çakışıyor, kapsamsız
 * kalsalar panoyu da boyarlardı.
 *
 * Pano (dashboard) bilinçli olarak ayrı bir görsel dil taşır: burada
 * yapılan hiçbir değişiklik globals.css'e veya components/ui'ye dokunmaz.
 *
 * Sayfa uygulamanın tema token'larını kullanmaz; kendi paletini taşır,
 * böylece açık tema seçen kullanıcıda da aynı görünümle açılır.
 */

const featureIcon = {
  stroke: "var(--color-text-2)",
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
    image: "/images/landing/kobiler.jpg",
    alt: "Atölyede kaynak yapan usta; koyu zeminde tek ışık kaynağı.",
    imageFirst: true,
  },
  {
    title: "Kurumsal gruplar",
    text: "Birden çok birim ve iştirakte anket atayın, tamamlanmayı tek panelden izleyin. Konsolide skorlar ve birim kıyasları raporlama döneminizi kısaltır.",
    caption: "Kurumsal grup görseli",
    image: "/images/landing/kurumsal-gruplar.jpg",
    alt: "Aşağıdan görünen gökdelen cephesi; tekrar eden pencere ızgarası.",
    imageFirst: false,
  },
  {
    title: "Danışmanlar ve eğitmenler",
    text: "Müşterilerinizin mevcut durumunu standart bir metodolojiyle tespit edin; öneri kütüphanesini kendi danışmanlık sürecinize temel yapın.",
    caption: "Danışmanlık görseli",
    image: "/images/landing/danismanlar.jpg",
    alt: "Sunum salonunda ön sıradan izleyiciler; sahne ışığı arkadan geliyor.",
    imageFirst: true,
  },
];

const resources = [
  {
    title: "ESG raporlama rehberi: nereden başlamalı?",
    text: "CSRD ve TSRS sonrası raporlama beklentileri ve olgunlukla ilişkisi.",
    image: "/images/landing/esg-raporlama.jpg",
    alt: "Rafta sıralanmış klasörler ve ciltli kayıt defterleri.",
  },
  {
    title: "Dijital olgunluk nedir, nasıl ölçülür?",
    text: "Veri, bulut, otomasyon ve siber güvenlik eksenlerinde 5 seviye.",
    image: "/images/landing/dijital-olgunluk.jpg",
    alt: "Veri merkezinde ağ kablolarıyla donatılmış sunucu kabinleri.",
  },
  {
    title: "Karbon ayak izi 101: Kapsam 1-2-3",
    text: "Ölçümden doğrulamaya temel kavramlar ve ilk adım planı.",
    image: "/images/landing/karbon-ayak-izi.jpg",
    alt: "Sisli dağ sırtında sıralanmış rüzgâr türbinleri.",
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
            <span style={{ color: "var(--color-text-3)" }}>
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
              <h1 aria-label="Kurumsal dönüşüm ölçümü basitleşti">
                <span>Kurumsal dönüşüm</span>
                <span>ölçümü basitleşti</span>
              </h1>
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

            <LandingTransformationLens />
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
          <h2 style={{ fontSize: 52, letterSpacing: "-0.03em", textAlign: "center" }}>Dönüşümünüzü büyütmek için her şey</h2>
          <p className="section-lede">Ölçümden yol haritasına, tek hesapta.</p>
          <div className="grid-3">
            {features.map((feature) => (
              <div key={feature.title} className="blueprint feature">
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
        <div style={{ padding: "0 var(--gutter) var(--section-y)", textAlign: "center" }}>
          <div className="kicker">Platformla tanışın</div>
          <h2 style={{ fontSize: 40, letterSpacing: "-0.03em", marginTop: 12 }}>Size sunacak çok şeyimiz var</h2>
          <figure className="blueprint" style={{ margin: "56px auto 0", maxWidth: 880 }}>
            <div className="shot shot-16x9">
              <img
                src="/images/landing/tanitim-videosu.jpg"
                alt="Çapraz açıyla görünen modern bina cephesi; tekrar eden cam paneller."
              />
            </div>
            <span className="play" aria-hidden>
              <span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-text)">
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
          <h2 style={{ fontSize: 40, letterSpacing: "-0.03em", textAlign: "center" }}>Neden ESG Akademi Anket?</h2>
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
          <h2 style={{ fontSize: 40, letterSpacing: "-0.03em", textAlign: "center" }}>Kimler kullanıyor?</h2>
          {audiences.map((audience) => {
            const image = (
              <figure className="blueprint" style={{ margin: 0 }}>
                <div className="shot shot-8x5">
                  <img src={audience.image} alt={audience.alt} />
                </div>
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
          <h2 style={{ fontSize: 40, letterSpacing: "-0.03em", textAlign: "center" }}>Başarı hikâyeleri</h2>
          <div className="quote-row">
            <div>
              <blockquote>
                “Anketi iki haftada tüm birimlerimizle tamamladık; çıkan yol haritası yönetim
                kurulu sunumumuzun omurgası oldu. Nerede olduğumuzu ilk kez sayılarla
                konuşabildik.”
              </blockquote>
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Elif Demir</div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-2)",
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
              <div className="shot shot-4x3">
                <img
                  src="/images/landing/musteri-tekstil.jpg"
                  alt="Karanlık bir atölyede çalışan dikiş makinesi."
                />
              </div>
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
              <h2 style={{ fontSize: 40, letterSpacing: "-0.03em", marginTop: 12 }}>Kaynak merkezimizi ziyaret edin</h2>
            </div>
            <Link href="/signup" className="btn btn-secondary">
              Keşfetmeye başlayın
            </Link>
          </div>

          <div className="grid-3" style={{ marginTop: 72 }}>
            {resources.map((resource) => (
              <div key={resource.title} className="blueprint resource">
                <div className="shot shot-card">
                  <img src={resource.image} alt={resource.alt} />
                </div>
                <div style={{ padding: 24 }}>
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
              <div className="brand" style={{ color: "var(--color-text)" }}>
                ESG Akademi / Anket
              </div>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  marginTop: 12,
                  maxWidth: "30ch",
                  color: "var(--color-text-2)",
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
