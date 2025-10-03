/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif']
      },
      colors: {
        'gpu-green': '#10B981',
        'gpu-red': '#EF4444',
        'gpu-blue': '#3B82F6'
      }
    },
  },
  plugins: [],
}

