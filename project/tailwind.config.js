/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        blue: {
          600: '#2c57a5',
          700: '#1e3d73',
          500: '#3968b8',
          100: '#e6f0ff',
          50: '#f0f7ff'
        },
        green: {
          600: '#66bb4b',
          700: '#4a8935',
          500: '#7bc95f',
          100: '#e6f7e1',
          50: '#f0fbed'
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif']
      }
    },
  },
  plugins: [],
};