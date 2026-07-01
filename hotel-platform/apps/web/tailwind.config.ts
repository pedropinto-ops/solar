import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Solar Irará Hotel — paleta terracota + cremes quentes ----
        // Marrom-café quente (textos)
        ink: {
          950: '#33241A',
          700: '#5C4A3C',
          500: '#8C7768',
          300: '#C3B2A2',
          100: '#EADFD4',
        },
        // PRIMÁRIA = terracota da marca (nome "teal" mantido p/ re-skin do app)
        teal: {
          900: '#9E4620',
          700: '#B85C2E',
          500: '#CB7A4C',
          100: '#F1DBC9',
          50:  '#FBF2EA',
        },
        // Alias semântico da terracota (usar em código novo)
        clay: {
          900: '#7C3717',
          800: '#9E4620',
          700: '#B85C2E',
          600: '#C56A3A',
          500: '#CB7A4C',
          300: '#E3B291',
          100: '#F1DBC9',
          50:  '#FBF2EA',
        },
        // Acento mel/ocre (harmoniza com a terracota)
        gold: {
          700: '#B27B32',
          500: '#D2A45E',
          100: '#F5E8CF',
          50:  '#FBF4E7',
        },
        // Neutros areia quentes
        sand: {
          200: '#E9DBC9',
          100: '#F4EADD',
          50:  '#FBF6EE',
        },
        cream: '#FFFDF9',
      },
      fontFamily: {
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Poppins"', 'system-ui', 'sans-serif'],
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
