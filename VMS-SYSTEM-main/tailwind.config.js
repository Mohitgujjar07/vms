/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50, #f5f3ff)',
          100: 'var(--brand-100, #ede9fe)',
          500: 'var(--brand-primary, #5B2C82)',
          600: 'var(--brand-dark, #4A2369)',
          700: 'var(--brand-700, #3B1B54)',
        }
      }
    },
  },
  plugins: [],
}
