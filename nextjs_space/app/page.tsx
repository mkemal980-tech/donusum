"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  BarChart3,
  Target,
  TrendingUp,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Leaf,
  Cpu,
  Globe,
  Shield,
  Users,
  Zap,
  ChevronDown,
  Sparkles,
  LineChart,
  Map,
} from "lucide-react";
import { useEffect, useState } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: BarChart3,
      title: "Olgunluk Analizi",
      description:
        "Kapsamlı anketlerle organizasyonunuzun mevcut olgunluk seviyesini 1-5 ölçeğinde ölçün ve sektör ortalamalarıyla karşılaştırın.",
    },
    {
      icon: Target,
      title: "Kıyaslama (Benchmark)",
      description:
        "Sektörünüzdeki en iyi uygulamalarla kendinizi kıyaslayın. Nerede olduğunuzu ve nereye gidebileceğinizi görün.",
    },
    {
      icon: Lightbulb,
      title: "Akıllı Öneriler",
      description:
        "Puanlarınıza göre kişiselleştirilmiş stratejik öneriler alın. Her öneri, somut aksiyon adımları içerir.",
    },
    {
      icon: Map,
      title: "Yol Haritası",
      description:
        "Önerileri çeyreklere dağıtarak stratejik bir yol haritası oluşturun. İlerlemenizi takip edin.",
    },
    {
      icon: LineChart,
      title: "Ironman Analizi",
      description:
        "Hız (Velocity) ve Dayanıklılık (Endurance) eksenlerinde konumunuzu görün. Sprinter mi, Maratoncu mu, yoksa Iron Man mı?",
    },
    {
      icon: TrendingUp,
      title: "İlerleme Takibi",
      description:
        "Zaman içindeki gelişiminizi izleyin. Geçmiş skorlarınızı karşılaştırın ve trendleri analiz edin.",
    },
  ];

  const useCases = [
    {
      icon: Leaf,
      title: "Sürdürülebilirlik Olgunluğu",
      color: "from-[var(--success)] to-[var(--accent)]",
      description:
        "Çevresel, sosyal ve yönetişim (ESG) kriterlerinde organizasyonunuzun olgunluk seviyesini ölçün.",
      examples: [
        "Karbon ayak izi yönetimi",
        "Döngüsel ekonomi uygulamaları",
        "Tedarik zinciri sürdürülebilirliği",
        "Sosyal sorumluluk projeleri",
        "ESG raporlama olgunluğu",
      ],
    },
    {
      icon: Cpu,
      title: "Dijital Olgunluk",
      color: "from-blue-500 to-[var(--blue-dark)]",
      description:
        "Dijital dönüşüm yolculuğunuzda nerede olduğunuzu ve nasıl ilerleyebileceğinizi keşfedin.",
      examples: [
        "Veri analitiği kapasitesi",
        "Bulut teknolojileri adaptasyonu",
        "Otomasyon ve yapay zeka",
        "Dijital müşteri deneyimi",
        "Siber güvenlik olgunluğu",
      ],
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: "Güvenilir Değerlendirme",
      description: "Sektör standartlarına dayalı objektif ölçüm metodolojisi",
    },
    {
      icon: Users,
      title: "Sektörel Kıyaslama",
      description: "Aynı sektördeki organizasyonlarla karşılaştırma imkanı",
    },
    {
      icon: Zap,
      title: "Hızlı Sonuçlar",
      description: "Anket tamamlandığında anında analiz ve öneriler",
    },
    {
      icon: Globe,
      title: "Kapsamlı Perspektif",
      description: "Tüm iş alanlarını kapsayan bütünsel değerlendirme",
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-main)" }}>
      {/* Floating Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "py-3"
            : "py-5"
        }`}
        style={{
          backgroundColor: scrolled ? "rgba(13, 17, 23, 0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid var(--border-soft)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <Sparkles className="w-5 h-5" style={{ color: "var(--bg-deep)" }} />
            </div>
            <span
              className="text-xl font-bold"
              style={{ color: "var(--text-main)" }}
            >
              Dönüşüm Platformu
            </span>
          </div>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg font-medium transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--bg-deep)",
            }}
          >
            Dashboard&apos;a Git
          </Link>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: "var(--accent)" }}
          />
          <div
            className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: "var(--blue-main)" }}
          />
          {/* Grid Pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)`,
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-8"
              style={{
                backgroundColor: "var(--accent-soft)",
                border: "1px solid var(--accent-glow)",
                color: "var(--accent)",
              }}
            >
              <Sparkles className="w-4 h-4" />
              Kurumsal Olgunluk Değerlendirme Platformu
            </div>

            <h1
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
              style={{ color: "var(--text-main)" }}
            >
              Dönüşüm Yolculuğunuzu{" "}
              <span style={{ color: "var(--accent)" }}>Ölçün</span>,{" "}
              <span style={{ color: "var(--blue-main)" }}>Planlayın</span>
            </h1>

            <p
              className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Sürdürülebilirlik ve dijital olgunluk seviyenizi analiz edin,
              sektörünüzle kıyaslayın ve stratejik yol haritanızı oluşturun.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="group px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 flex items-center gap-2"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--bg-deep)",
                  boxShadow: "0 0 30px var(--accent-glow)",
                }}
              >
                Hemen Başla
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#features"
                className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center gap-2"
                style={{
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                Özellikleri Keşfet
                <ChevronDown className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-10 rounded-full flex justify-center pt-2"
              style={{ border: "2px solid var(--border-soft)" }}
            >
              <motion.div
                animate={{ height: [8, 16, 8] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1 rounded-full"
                style={{ backgroundColor: "var(--accent)" }}
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeInUp}
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              Platform Özellikleri
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg max-w-2xl mx-auto"
              style={{ color: "var(--text-muted)" }}
            >
              Kapsamlı araçlarla kurumsal dönüşüm sürecinizi yönetin
            </motion.p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--accent-soft)",
                  }}
                >
                  <feature.icon
                    className="w-7 h-7"
                    style={{ color: "var(--accent)" }}
                  />
                </div>
                <h3
                  className="text-xl font-semibold mb-2"
                  style={{ color: "var(--text-main)" }}
                >
                  {feature.title}
                </h3>
                <p style={{ color: "var(--text-muted)" }}>{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 relative" style={{ backgroundColor: "var(--bg-deep)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeInUp}
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              Kullanım Alanları
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg max-w-2xl mx-auto"
              style={{ color: "var(--text-muted)" }}
            >
              Farklı dönüşüm alanlarında olgunluk seviyenizi ölçün
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {useCases.map((useCase, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative overflow-hidden rounded-2xl p-8"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                {/* Gradient accent */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${useCase.color}`}
                />

                <div className="flex items-start gap-4 mb-6">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br ${useCase.color}`}
                  >
                    <useCase.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3
                      className="text-2xl font-bold"
                      style={{ color: "var(--text-main)" }}
                    >
                      {useCase.title}
                    </h3>
                    <p className="mt-1" style={{ color: "var(--text-muted)" }}>
                      {useCase.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {useCase.examples.map((example, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ backgroundColor: "var(--bg-card-2)" }}
                    >
                      <CheckCircle2
                        className="w-5 h-5 flex-shrink-0"
                        style={{ color: "var(--accent)" }}
                      />
                      <span style={{ color: "var(--text-main)" }}>{example}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-16"
          >
            <motion.h2
              variants={fadeInUp}
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: "var(--text-main)" }}
            >
              Nasıl Çalışır?
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="text-lg max-w-2xl mx-auto"
              style={{ color: "var(--text-muted)" }}
            >
              Dört basit adımda dönüşüm yolculuğunuzu başlatın
            </motion.p>
          </motion.div>

          <div className="relative">
            {/* Connection Line */}
            <div
              className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2"
              style={{ backgroundColor: "var(--border-soft)" }}
            />

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  step: "01",
                  title: "Anketi Tamamlayın",
                  description:
                    "Size atanan olgunluk anketini cevaplayarak mevcut durumunuzu değerlendirin.",
                },
                {
                  step: "02",
                  title: "Sonuçları İnceleyin",
                  description:
                    "Detaylı analiz raporlarınızı ve sektörel kıyaslamalarınızı görüntüleyin.",
                },
                {
                  step: "03",
                  title: "Önerileri Alın",
                  description:
                    "Puanlarınıza göre özelleştirilmiş stratejik önerileri keşfedin.",
                },
                {
                  step: "04",
                  title: "Yol Haritası Oluşturun",
                  description:
                    "Önerileri zamana yayarak aksiyon planınızı oluşturun ve takip edin.",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative text-center"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "2px solid var(--accent)",
                    }}
                  >
                    <span
                      className="text-xl font-bold"
                      style={{ color: "var(--accent)" }}
                    >
                      {item.step}
                    </span>
                  </div>
                  <h3
                    className="text-xl font-semibold mb-2"
                    style={{ color: "var(--text-main)" }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ color: "var(--text-muted)" }}>{item.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section
        className="py-24 relative"
        style={{ backgroundColor: "var(--bg-deep)" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            <div>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl md:text-5xl font-bold mb-6"
                style={{ color: "var(--text-main)" }}
              >
                Neden Bu{" "}
                <span style={{ color: "var(--accent)" }}>Platform?</span>
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-lg mb-8"
                style={{ color: "var(--text-muted)" }}
              >
                Kurumsal dönüşüm süreçlerinizi veri odaklı bir yaklaşımla
                yönetmenizi sağlayan kapsamlı bir platform sunuyoruz.
              </motion.p>

              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    variants={fadeInUp}
                    className="flex items-start gap-4"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "var(--accent-soft)" }}
                    >
                      <benefit.icon
                        className="w-6 h-6"
                        style={{ color: "var(--accent)" }}
                      />
                    </div>
                    <div>
                      <h4
                        className="font-semibold text-lg"
                        style={{ color: "var(--text-main)" }}
                      >
                        {benefit.title}
                      </h4>
                      <p style={{ color: "var(--text-muted)" }}>
                        {benefit.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              variants={fadeInUp}
              className="relative"
            >
              {/* Stats Card */}
              <div
                className="rounded-2xl p-8"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <h3
                  className="text-2xl font-bold mb-8 text-center"
                  style={{ color: "var(--text-main)" }}
                >
                  Platform İstatistikleri
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { value: "1-5", label: "Olgunluk Ölçeği" },
                    { value: "4", label: "Kadran Analizi" },
                    { value: "∞", label: "Özelleştirilebilir Anket" },
                    { value: "24/7", label: "Erişilebilirlik" },
                  ].map((stat, index) => (
                    <div
                      key={index}
                      className="text-center p-4 rounded-xl"
                      style={{ backgroundColor: "var(--bg-card-2)" }}
                    >
                      <div
                        className="text-3xl font-bold mb-1"
                        style={{ color: "var(--accent)" }}
                      >
                        {stat.value}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decorative elements */}
              <div
                className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-20 blur-2xl"
                style={{ backgroundColor: "var(--accent)" }}
              />
              <div
                className="absolute -bottom-4 -left-4 w-32 h-32 rounded-full opacity-20 blur-2xl"
                style={{ backgroundColor: "var(--blue-main)" }}
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10 blur-3xl"
            style={{ backgroundColor: "var(--accent)" }}
          />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-6"
              style={{ color: "var(--text-main)" }}
            >
              Dönüşüm Yolculuğunuza Başlayın
            </h2>
            <p
              className="text-xl mb-10"
              style={{ color: "var(--text-muted)" }}
            >
              Kurumunuzun olgunluk seviyesini ölçün, güçlü ve gelişim alanlarınızı
              belirleyin, stratejik yol haritanızı oluşturun.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-10 py-5 rounded-xl font-semibold text-xl transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--bg-deep)",
                boxShadow: "0 0 50px var(--accent-glow)",
              }}
            >
              Dashboard&apos;a Git
              <ArrowRight className="w-6 h-6" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 border-t"
        style={{
          backgroundColor: "var(--bg-deep)",
          borderColor: "var(--border-soft)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p style={{ color: "var(--text-dim)" }}>
            © {new Date().getFullYear()} Dönüşüm Platformu. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}