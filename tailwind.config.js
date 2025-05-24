/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'bounce-once': 'bounce 1s ease-in-out 1',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        'neon': '0 0 5px #4f46e5, 0 0 10px #4f46e5, 0 0 15px #4f46e5',
        'glow': '0 0 20px rgba(79, 70, 229, 0.3)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
} 