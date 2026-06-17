import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Sidebar
        sidebar:       '#1C1007',
        'sidebar-hover': '#2E1A0A',
        'sidebar-active': '#3D2310',
        // Content
        primary:  { DEFAULT: '#2C1810', light: '#4A2C20' },
        accent:   { DEFAULT: '#C89B6D', light: '#E8C9A0' },
        bg:       '#F4F2EE',
        surface:  '#FFFFFF',
        text:     '#1A1A1A',
        muted:    '#9A8C82',
        border:   '#E8E2DA',
        error:    '#DC2626',
        success:  '#16A34A',
        warning:  '#D97706',
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans:  ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-dm-mono)', 'monospace'],
      },
      borderRadius: {
        xl:  '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 8px rgba(0,0,0,0.06)',
        md:   '0 4px 16px rgba(0,0,0,0.08)',
      },
      width: {
        sidebar: '240px',
      },
    },
  },
  plugins: [],
};

export default config;
