"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Hata durumunda gösterilecek kısa etiket (örn. "Grafik yüklenemedi") */
  label?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Satır-içi (bölüm bazlı) hata sınırı.
 *
 * ChunkErrorBoundary tüm sayfayı devralır; bu bileşen ise yalnızca sardığı
 * bölümü izole eder. Bir grafik/panel render sırasında patlarsa sayfanın
 * geri kalanı çalışmaya devam eder ve kullanıcı küçük bir hata mesajı görür.
 */
export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("SectionErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]"
        >
          <AlertTriangle size={18} className="text-[var(--warning)] shrink-0" />
          <span>{this.props.label ?? "Bu bölüm yüklenemedi."}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
