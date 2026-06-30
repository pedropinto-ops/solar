import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0F1F26',
          700: '#3A4A52',
          500: '#6B7A82',
          300: '#B5BFC4',
          100: '#E5E9EB',
        },
        teal: {
          900: '#0E3940',
          700: '#1A5560',
          500: '#2A7785',
          100: '#C4DBE0',
          50:  '#E8F0F2',
        },
        gold: {
          700: '#9D7A3C',
          500: '#C49B5C',
          100: '#F5EBD8',
          50:  '#FBF6EC',
        },
        sand: {
          200: '#E6DECF',
          100: '#F2EDE4',
          50:  '#FAF7F2',
        },
        cream: '#FFFEFB',
      },
      fontFamily: {
        serif: ['"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        wider: '0.06em',
        widest: '0.08em',
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      minHeight: {
        'touch-sm': '44px',
        'touch-md': '48px',
      },
      minWidth: {
        'touch-sm': '44px',
        'touch-md': '48px',
      },
      animation: {
        'slide-up': 'slideUp 0.25s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
