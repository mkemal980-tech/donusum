"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useState, useEffect, Component, ReactNode } from "react";
import { Toaster } from "sonner";
import { RefreshCw } from "lucide-react";

// Global Error Boundary for catching chunk loading errors
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ChunkErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Log chunk load errors
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      console.error('Chunk loading failed:', error);
    }
  }

  handleReload = () => {
    // Clear cache and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
                          this.state.error?.message?.includes('Loading chunk');
      
      return (
        <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] p-8 rounded-xl border border-[var(--border-soft)] max-w-md text-center">
            <div className="w-16 h-16 bg-[var(--accent)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-main)] mb-2">
              {isChunkError ? 'Sayfa Yüklenemedi' : 'Bir Hata Oluştu'}
            </h2>
            <p className="text-[var(--text-muted)] mb-4">
              {isChunkError
                ? 'Ağ bağlantısı sorunu nedeniyle sayfa bileşenleri yüklenemedi. Lütfen sayfayı yenileyin.'
                : 'Beklenmeyen bir hata oluştu. Sayfayı yenilemek çoğu durumda yeterli olur; sorun sürerse aşağıdaki teknik ayrıntıyı bize iletin.'}
            </p>
            {/* Sebebi saklamak kullanıcıya yardımcı olmuyor, destek isteğini de
                "bir şey oldu"ya indiriyordu. Mesaj olduğu gibi görünür. */}
            {!isChunkError && this.state.error?.message && (
              <p className="mb-6 px-3 py-2 rounded-lg bg-[var(--bg-card-2)] text-left text-xs font-mono text-[var(--text-dim)] break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={this.handleReload}
                className="px-6 py-3 bg-[var(--accent)] text-[var(--bg-deep)] font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Sayfayı Yenile
              </button>
              <a
                href="/"
                className="px-6 py-3 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                Ana sayfaya dön
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange={false}
      >
        <ChunkErrorBoundary>
          {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
        </ChunkErrorBoundary>
        <Toaster 
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-soft)'
            }
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
