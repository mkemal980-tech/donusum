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
        // Primary Blue/Cyan palette
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#3b82f6',
          foreground: '#ffffff',
        },
        // Secondary Cyan/Teal palette
        secondary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          DEFAULT: '#06b6d4',
          foreground: '#ffffff',
        },
        // Accent Green/Emerald
        accent: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          DEFAULT: '#10b981',
          foreground: '#ffffff',
        },
        // Background colors
        background: {
          DEFAULT: 'var(--bg-main)',
          secondary: 'var(--bg-secondary)',
          card: 'var(--bg-card)',
          sidebar: 'var(--bg-sidebar)',
        },
        // Card colors
        card: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-primary)',
        },
        // Text colors
        foreground: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        // Status colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          600: '#059669',
          DEFAULT: '#10b981',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          DEFAULT: '#f59e0b',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          DEFAULT: '#ef4444',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          DEFAULT: '#3b82f6',
        },
        // Border colors
        border: {
          DEFAULT: 'var(--border-light)',
          primary: 'var(--border-primary)',
        },
        // Muted
        muted: {
          DEFAULT: 'var(--bg-secondary)',
          foreground: 'var(--text-muted)',
        },
        // Popover
        popover: {
          DEFAULT: 'var(--bg-card)',
          foreground: 'var(--text-primary)',
        },
        // Input
        input: 'var(--border-light)',
        // Ring
        ring: 'var(--primary)',
        // Chart colors
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        // Dark mode specific
        dark: {
          bg: '#0a1628',
          card: '#162033',
          border: '#1e3a5f',
        },
      },
      borderRadius: {
        lg: '1rem',
        md: '0.75rem',
        sm: '0.5rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': 'var(--shadow-card)',
        'soft-lg': '0 8px 30px rgba(59, 130, 246, 0.15)',
        'soft-xl': '0 12px 40px rgba(59, 130, 246, 0.2)',
        'primary': '0 4px 15px rgba(59, 130, 246, 0.4)',
        'primary-lg': '0 8px 25px rgba(59, 130, 246, 0.5)',
        'card': 'var(--shadow-card)',
        'card-hover': '0 8px 30px rgba(59, 130, 246, 0.2)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
        'gradient-secondary': 'linear-gradient(135deg, var(--secondary) 0%, var(--secondary-dark) 100%)',
        'gradient-accent': 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0a1628 0%, #111d32 100%)',
        'gradient-card-dark': 'linear-gradient(135deg, #162033 0%, #111d32 100%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
          '0%, 100%': { boxShadow: '0 0 5px var(--primary)' },
          '50%': { boxShadow: '0 0 20px var(--primary), 0 0 30px var(--primary)' },
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
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
