/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dhukuti brand colors
        brand: {
          crimson:      '#B91C1C',
          crimsonDark:  '#7F1D1D',
          crimsonLight: '#FEE2E2',
          gold:         '#B45309',
          goldLight:    '#FEF3C7',
          teal:         '#0F766E',
          tealLight:    '#CCFBF1',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Times New Roman', 'serif'],
        body:    ['Manrope', 'Avenir Next', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
