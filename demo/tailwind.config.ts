import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 东方武侠 · 暗色高级感
        ink: {
          900: '#0E1116',
          800: '#161C24',
          700: '#1F2732',
          600: '#28313D',
        },
        blood: {
          DEFAULT: '#C8102E',
          light: '#E63946',
        },
        gold: {
          DEFAULT: '#E8C87A',
          bright: '#F4A62A',
        },
        jade: '#2DD4A7',
        alert: '#EF4444',
        warn: '#FACC15',
        info: '#3B82F6',
        parchment: '#F5F7FA',
        muted: '#AAB4C0',
      },
      fontFamily: {
        sans: [
          '"Source Han Sans SC"',
          '"思源黑体"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        neon: '0 0 18px rgba(230, 57, 70, 0.65)',
        gold: '0 0 16px rgba(232, 200, 122, 0.5)',
      },
      backgroundImage: {
        'radial-table':
          'radial-gradient(ellipse at center, #223042 0%, #141b24 55%, #0b0f14 100%)',
      },
      keyframes: {
        'damage-pop': {
          '0%': { transform: 'scale(0.4) translateY(10px)', opacity: '0' },
          '30%': { transform: 'scale(1.3) translateY(-6px)', opacity: '1' },
          '70%': { transform: 'scale(1) translateY(-24px)', opacity: '1' },
          '100%': { transform: 'scale(0.9) translateY(-48px)', opacity: '0' },
        },
        'shake': {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-4px)' },
          '40%,80%': { transform: 'translateX(4px)' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-8px)' },
        },
        'trace-fade': {
          '0%': { opacity: '0' },
          '25%': { opacity: '0.8' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'damage-pop': 'damage-pop 1.1s ease-out forwards',
        'shake': 'shake 0.4s ease-in-out',
        'float-up': 'float-up 0.2s ease-out forwards',
        'trace-fade': 'trace-fade 0.6s ease-out forwards',
      },
    },
  },
  plugins: [animate],
};

export default config;
