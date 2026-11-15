/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          900: '#0c4a6e',
        },
        vp: {
          porcelain: '#FAF8F5',
          stone: '#D8CFC0',
          charcoal: '#1A1815',
          onyx: '#0A0A0C',
          orange: '#EA580C',
          amber: '#F59E0B',
        },
      },
    },
  },
  plugins: [],
};

