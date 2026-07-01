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
        // Dourado-mostarda do sol da marca (acento quente)
        gold: {
          700: '#C8871F',
          500: '#E8A33D',
          300: '#F0C079',
          100: '#F8E4C0',
          50:  '#FCF4E2',
        },
        // Verde-folha (botânica da identidade — acentos sutis)
        leaf: {
          700: '#4E7A34',
          500: '#6E9E4F',
          100: '#DCE8CC',
        },
        // Neutros areia / creme quentes (fundo tipo timbrado)
        sand: {
          200: '#E7D6C0',
          100: '#F2E6D4',
          50:  '#F8F0E1',
        },
        cream: '#FFFBF4',
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
