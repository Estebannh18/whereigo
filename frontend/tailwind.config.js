/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Color de marca: azul "movilidad", usado en acciones primarias y rutas de bus.
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#608bfa',
          500: '#3b66f5',
          600: '#2549ea',
          700: '#1d37d7',
          800: '#1e2fae',
          900: '#1e2d89',
          950: '#171e54',
        },
        // Colores por tipo de ruta (mismos valores que usa el mapa en lib/routeStyle.ts).
        route: {
          bus: '#2549ea',
          taxi: '#f59e0b',
          mixed: '#0d9488',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f6f7fb',
          sunken: '#eef0f6',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        float: '0 8px 24px -6px rgba(16, 24, 40, 0.18), 0 2px 6px rgba(16, 24, 40, 0.08)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.6)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
      },
    },
  },
  plugins: [],
};
