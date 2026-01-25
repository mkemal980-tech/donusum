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
        
        // Accent Turquoise
        'accent': {
          DEFAULT: 'var(--accent)',
          dark: 'var(--accent-dark)',
          bright: 'var(--accent-bright)',
          cyan: 'var(--accent-cyan)',
        },
        
        // Blue Chart Colors
        'blue': {
          main: 'var(--blue-main)',
          dark: 'var(--blue-dark)',
          light: 'var(--blue-light)',
          teal: 'var(--blue-teal)',
        },
        
        // UI Passive
        'ui-passive': 'var(--ui-passive)',
        
        // Legacy compatibility
        primary: {
          50: '#e6fafa',
          100: '#ccf5f5',
          200: '#99ebeb',
          300: '#66e0e0',
          400: '#33d6d6',
          500: '#0CC1C3',
          600: '#0BAFB3',
          700: '#099a9c',
          800: '#078586',
          900: '#056f70',
          DEFAULT: 'var(--accent)',
          foreground: 'var(--bg-deep)',
        },
        secondary: {
          50: '#e8f4ff',
          100: '#d1e9ff',
          200: '#a3d3ff',
          300: '#75bdff',
          400: '#47a7ff',
          500: '#2E86FF',
          600: '#1A63E8',
          700: '#1550c0',
          800: '#103d99',
          900: '#0b2a71',
          DEFAULT: 'var(--blue-main)',
          foreground: '#ffffff',
        },
        
        // Background colors
        background: {
          DEFAULT: 'var(--bg-main)',
          secondary: 'var(--bg-deep)',
          card: 'var(--bg-card)',
          sidebar: 'var(--bg-deep)',
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
          50: 'rgba(12, 193, 195, 0.1)',
          100: 'rgba(12, 193, 195, 0.15)',
          500: 'var(--success)',
          600: '#0BAFB3',
          DEFAULT: 'var(--success)',
        },
        warning: {
          50: 'rgba(245, 166, 35, 0.1)',
          100: 'rgba(245, 166, 35, 0.15)',
          500: 'var(--warning)',
          600: '#D99520',
          DEFAULT: 'var(--warning)',
        },
        error: {
          50: 'rgba(229, 77, 77, 0.1)',
          100: 'rgba(229, 77, 77, 0.15)',
          500: 'var(--error)',
          600: '#CC4444',
          DEFAULT: 'var(--error)',
        },
        info: {
          50: 'rgba(46, 134, 255, 0.1)',
          100: 'rgba(46, 134, 255, 0.15)',
          500: 'var(--info)',
          600: '#1A63E8',
          DEFAULT: 'var(--info)',
        },
        
        // Border colors
        border: {
          DEFAULT: 'var(--border-soft)',
          primary: 'var(--accent)',
        },
        
        // Muted
        muted: {
          DEFAULT: 'var(--bg-card-2)',
          foreground: 'var(--text-dim)',
        },
        
        // Popover
        popover: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-main)',
        },
        
        // Input
        input: 'var(--border-soft)',
        
        // Ring
        ring: 'var(--accent-cyan)',
        
        // Chart colors
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        xl: 'var(--radius-xl)',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': 'var(--shadow-card)',
        'soft-lg': '0 8px 30px rgba(12, 193, 195, 0.12)',
        'soft-xl': '0 12px 40px rgba(12, 193, 195, 0.15)',
        'primary': '0 4px 15px rgba(12, 193, 195, 0.3)',
        'primary-lg': '0 8px 25px rgba(12, 193, 195, 0.4)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-glow)',
        'glow': 'var(--shadow-glow)',
        'glow-accent': '0 0 20px rgba(12, 193, 195, 0.3)',
        'glow-blue': '0 0 20px rgba(46, 134, 255, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
        'gradient-secondary': 'linear-gradient(135deg, var(--blue-main) 0%, var(--blue-dark) 100%)',
        'gradient-accent': 'linear-gradient(135deg, var(--accent-bright) 0%, var(--accent) 100%)',
        'gradient-dark': 'linear-gradient(180deg, var(--bg-main) 0%, var(--bg-deep) 100%)',
        'gradient-card': 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card-2) 100%)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        numeric: ['Roboto', 'system-ui', 'sans-serif'],
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
        'glow': {
          '0%, 100%': { boxShadow: '0 0 5px var(--accent)' },
          '50%': { boxShadow: '0 0 20px var(--accent), 0 0 30px var(--accent-bright)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
