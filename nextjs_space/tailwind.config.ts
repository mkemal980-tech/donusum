import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Tailwind 3.3 `min-h-48` gibi aralık tabanlı min-height/min-width
      // sınıflarını üretmez (3.4 ile geldi); ölçek burada açılır.
      minHeight: ({ theme }) => ({ ...theme('spacing') }),
      minWidth: ({ theme }) => ({ ...theme('spacing') }),
      colors: {
        // Theme Backgrounds
        'bg-main': 'var(--bg-main)',
        'bg-deep': 'var(--bg-deep)',
        'bg-card': 'var(--bg-card)',
        'bg-card-2': 'var(--bg-card-2)',
        
        // Theme Borders
        'border-soft': 'var(--border-soft)',
        'divider': 'var(--divider)',
        
        // Theme Text
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
        
        // Vurgu: iso2app turuncusu
        'accent': {
          DEFAULT: 'var(--accent)',
          solid: 'var(--accent-solid)',
          dark: 'var(--accent-dark)',
          bright: 'var(--accent-bright)',
          cyan: 'var(--accent-cyan)',
        },
        
        // Eski grafik adları (vurguya bağlı)
        'blue': {
          main: 'var(--blue-main)',
          dark: 'var(--blue-dark)',
          light: 'var(--blue-light)',
          teal: 'var(--blue-teal)',
        },
        
        // UI Passive
        'ui-passive': 'var(--ui-passive)',
        
        /* Sayısal basamaklar iso2app marka rampasıdır (color-brand-*);
           depoda kalan primary-500 gibi çağrılar da turuncuya iner. */
        primary: {
          50:  '#fff1eb',
          100: '#ffe1d3',
          200: '#ffc2a8',
          300: '#ff9f78',
          400: '#ff7a45',
          500: 'var(--accent)',
          600: 'var(--accent-hover)',
          700: 'var(--accent-ink)',
          800: '#8a2c0e',
          900: '#4a180a',
          DEFAULT: 'var(--accent)',
          foreground: 'var(--on-accent)',
        },
        /* İkincil = 2. veri serisi (yeşil). Eylem rengi değildir. */
        secondary: {
          50:  'oklch(0.955 0.025 165)',
          100: 'oklch(0.900 0.050 165)',
          200: 'oklch(0.850 0.085 165)',
          300: 'oklch(0.800 0.115 165)',
          400: 'oklch(0.775 0.135 165)',
          500: 'var(--series-2)',
          600: 'oklch(0.680 0.145 165)',
          700: 'oklch(0.590 0.130 165)',
          800: 'oklch(0.490 0.105 165)',
          900: 'oklch(0.390 0.080 165)',
          DEFAULT: 'var(--series-2)',
          foreground: 'var(--canvas)',
        },
        
        // Background colors
        background: {
          DEFAULT: 'var(--canvas)',
          secondary: 'var(--rail)',
          card: 'var(--surface)',
          sidebar: 'var(--rail)',
        },
        
        // Card colors
        card: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-main)',
        },
        
        // Text colors
        foreground: {
          DEFAULT: 'var(--text-main)',
          secondary: 'var(--text-muted)',
          muted: 'var(--text-dim)',
        },
        
        // Status colors
        success: {
          50: 'var(--success-bg)',
          100: 'var(--success-bg)',
          500: 'var(--success)',
          600: 'var(--success-solid)',
          DEFAULT: 'var(--success)',
        },
        warning: {
          50: 'var(--warning-bg)',
          100: 'var(--warning-bg)',
          500: 'var(--warning)',
          600: 'var(--warning-solid)',
          DEFAULT: 'var(--warning)',
        },
        error: {
          50: 'var(--error-bg)',
          100: 'var(--error-bg)',
          500: 'var(--error)',
          600: 'var(--error-solid)',
          DEFAULT: 'var(--error)',
        },
        info: {
          50: 'var(--info-bg)',
          100: 'var(--info-bg)',
          500: 'var(--info)',
          600: 'var(--accent-press)',
          DEFAULT: 'var(--info)',
        },
        
        // Border colors
        border: {
          DEFAULT: 'var(--border-soft)',
          primary: 'var(--accent)',
        },
        
        // Muted
        muted: {
          DEFAULT: 'var(--surface-2)',
          foreground: 'var(--ink-3)',
        },
        
        // Popover
        popover: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-main)',
        },
        
        // Input
        input: 'var(--line-strong)',
        
        // Ring
        ring: 'var(--accent)',
        
        // Anlamsal yüzey/mürekkep adları — yeni kod bunları kullanır.
        canvas: 'var(--canvas)',
        rail: 'var(--rail)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        series: {
          1: 'var(--series-1)',
          2: 'var(--series-2)',
          3: 'var(--series-3)',
          4: 'var(--series-4)',
          5: 'var(--series-5)',
        },

        // Chart colors
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
      },
      /* Yarıçap token'ları dışına çıkılmaz (bkz. DESIGN.md > Radius): kontrol
         9px, düğme 10px, kart 14px. Depoda kalan rounded-xl / rounded-2xl /
         rounded-3xl çağrıları da kart yarıçapına iner. */
      borderRadius: {
        none: '0',
        sm: 'var(--radius-xs)',
        DEFAULT: 'var(--radius-xs)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-lg)',
        '2xl': 'var(--radius-lg)',
        '3xl': 'var(--radius-lg)',
        full: 'var(--radius-pill)',
      },
      /* iso2app elevation: kart 1px kenar + hafif gölge (shadow-sm), üst
         katmanlar (dropdown, popover, modal) md/lg. Parlama yok. */
      boxShadow: {
        none: 'none',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-md)',
        xl: 'var(--shadow-lg)',
        '2xl': 'var(--shadow-lg)',
        inner: 'none',
        soft: 'var(--shadow-sm)',
        'soft-lg': 'var(--shadow-md)',
        'soft-xl': 'var(--shadow-lg)',
        card: 'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
        glow: 'none',
        'glow-accent': 'none',
        'glow-blue': 'none',
        primary: 'var(--shadow-button)',
        'primary-lg': 'var(--shadow-button)',
        button: 'var(--shadow-button)',
        overlay: 'var(--shadow-overlay)',
      },
      /* Dekoratif degrade yok. Kalan adlar düz renge bağlandı ki depodaki
         eski çağrı yerleri degrade değil, düz vurgu çizsin. */
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(var(--accent), var(--accent))',
        'gradient-secondary': 'linear-gradient(var(--series-2), var(--series-2))',
        'gradient-accent': 'linear-gradient(var(--accent), var(--accent))',
        'gradient-dark': 'linear-gradient(var(--canvas), var(--canvas))',
        'gradient-card': 'linear-gradient(var(--surface), var(--surface))',
        'chart-area': 'linear-gradient(180deg, var(--chart-gradient-start), var(--chart-gradient-end))',
      },
      // iso2app yazı tipleri: gövde IBM Plex Sans, başlık ve KPI Space
      // Grotesk, etiket/kod/tablo sayıları IBM Plex Mono (app/layout.tsx).
      fontFamily: {
        sans: ['var(--font-ibm-plex-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'var(--font-ibm-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        numeric: ['var(--font-ibm-plex-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        caption: ['var(--text-caption)', { lineHeight: '1.4', letterSpacing: '0.06em' }],
        sm: ['var(--text-sm)', { lineHeight: '1.5' }],
        base: ['var(--text-body)', { lineHeight: '1.55' }],
        subhead: ['var(--text-subhead)', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        title: ['var(--text-title)', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        metric: ['var(--text-metric)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        display: ['var(--text-display)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
      },
      transitionTimingFunction: {
        'out-quart': 'var(--ease-out-quart)',
        'in-quart': 'var(--ease-in-quart)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '170ms',
        slow: '260ms',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 260ms var(--ease-out-quart)',
        'slide-in': 'slide-in 260ms var(--ease-out-quart)',
        'scale-in': 'scale-in 170ms var(--ease-out-quart)',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
