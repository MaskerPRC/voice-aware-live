/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef3f0',
          100: '#fde3dc',
          200: '#fcc8b9',
          300: '#f9a388',
          400: '#f07550',
          500: '#e05d34',
          600: '#cc4824',
          700: '#ab381c',
          800: '#8c301c',
          900: '#742c1c'
        },
        surface: '#fcfbf9'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif']
      },
      borderRadius: {
        '4xl': '2rem'
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.04)',
        float: '0 4px 16px rgba(0,0,0,0.07)',
        pill: '0 2px 8px rgba(0,0,0,0.05)'
      }
    }
  },
  plugins: []
}
