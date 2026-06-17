/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f13',
        card: '#1a1a24',
        accent: '#7c6af7',
      }
    },
  },
  plugins: [],
}
