/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'tt-green': '#00843D',
        'tt-yellow': '#FFCD00',
        'tt-orange': '#F37021',
        'tt-navy': '#003399',
        'tt-black': '#1A1A1A',
      },
    },
  },
  plugins: [],
}

