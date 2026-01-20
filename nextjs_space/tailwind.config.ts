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
        // Primary Purple/Indigo palette
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#6366f1',
          foreground: '#ffffff',
        },
        // Secondary Purple palette
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
          DEFAULT: '#8b5cf6',
          foreground: '#ffffff',
        },
        // Background colors
        background: {
          DEFAULT: '#e8e6f3',
          light: '#f1f0f7',
          dark: '#ddd9ed',
        },
        // Card colors
        card: {
          DEFAULT: '#ffffff',
          dark: '#5b5fc7',
          darker: '#4338ca',
          foreground: '#1e1b4b',
        },
        // Text colors
        foreground: {
          DEFAULT: '#1e1b4b',
          muted: '#6b7280',
          light: '#9ca3af',
        },
        // Status colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          DEFAULT: '#22c55e',
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
          DEFAULT: '#e5e7eb',
          light: '#f3f4f6',
          primary: '#c7d2fe',
        },
        // Muted backgrounds
        muted: {
          DEFAULT: '#f3f4f6',
          foreground: '#6b7280',
        },
        // Accent
        accent: {
          DEFAULT: '#f3f4f6',
          foreground: '#1e1b4b',
        },
        // Destructive
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        // Popover
        popover: {
          DEFAULT: '#ffffff',
          foreground: '#1e1b4b',
        },
        // Input
        input: '#e5e7eb',
        // Ring
        ring: '#6366f1',
        // Chart colors
        chart: {
          '1': '#6366f1',
          '2': '#8b5cf6',
          '3': '#a78bfa',
          '4': '#c4b5fd',
          '5': '#ddd6fe',
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
        'soft': '0 4px 20px rgba(99, 102, 241, 0.1)',
        'soft-lg': '0 8px 30px rgba(99, 102, 241, 0.15)',
        'soft-xl': '0 12px 40px rgba(99, 102, 241, 0.2)',
        'primary': '0 4px 15px rgba(99, 102, 241, 0.4)',
        'primary-lg': '0 8px 25px rgba(99, 102, 241, 0.5)',
        'card': '0 4px 20px rgba(99, 102, 241, 0.1)',
        'card-hover': '0 8px 30px rgba(99, 102, 241, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        'gradient-card': 'linear-gradient(135deg, #5b5fc7 0%, #4338ca 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        'gradient-bg': 'linear-gradient(135deg, #e8e6f3 0%, #ddd9ed 50%, #e8e6f3 100%)',
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
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
