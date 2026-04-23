/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#08090d',
        surface: '#0f1117',
        border: '#1e2130',
        green: { DEFAULT: '#22c55e', dim: '#16a34a' },
        red: { DEFAULT: '#ef4444', dim: '#b91c1c' },
        amber: { DEFAULT: '#f59e0b', dim: '#d97706' },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
