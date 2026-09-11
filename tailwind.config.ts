import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        archivo: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        hanken: ['var(--font-hanken)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Colores corporativos "Yo me Encargo" - Paleta del logo
        brand: {
          blue: '#6FA8DC',      // Azul Cielo (Color Principal / Cabeceras)
          'blue-light': '#E1F0FA', // Azul Muy Claro (Fondos suaves / Degradados)
          cyan: '#6FA8DC',      // Celeste (usado como variante del azul)
          'cyan-light': '#E1F0FA', // Celeste claro (usado como variante del azul claro)
          green: '#8CC63F',     // Verde Lima (Acento Principal / Botones)
          'green-light': '#A8D66F', // Verde Lima más claro (hover states)
          'green-dark': '#2F9D59', // Verde Bosque (Detalles / Bordes)
          'blue-dark': '#2C5282',   // Azul autoridad (alternativa CTA)
          'green-hover': '#6FA52E', // Verde hover
          gray: '#666666',      // Gris Oscuro (Elementos neutros / Footer)
          'gray-light': '#999999', // Gris claro (variante)
          'gray-dark': '#666666', // Gris oscuro (Footer)
        },
        // primary es TEMEABLE por variables CSS: por defecto (:root en globals.css) es el
        // azul del logo — así el panel admin y todo lo que no esté bajo .theme-cotizador
        // no cambia. Dentro de .theme-cotizador se sobreescriben a verde para que el
        // cotizador comparta la identidad de la landing sin tocar el resto del sistema.
        primary: {
          50: 'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
          900: 'rgb(var(--primary-900) / <alpha-value>)',
        },
        secondary: {
          50: '#F0F8E8',
          100: '#E0F1D1',
          200: '#C8E4A8',
          300: '#B0D77F',
          400: '#98CA56',
          500: '#8CC63F',       // Verde Lima (Acento Principal)
          600: '#7AB033',
          700: '#689A27',
          800: '#56841B',
          900: '#446E0F',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config

