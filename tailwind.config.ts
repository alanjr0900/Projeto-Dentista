import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7f7',
          100: '#dcf0f0',
          200: '#b9e1e1',
          300: '#85c9c9',
          400: '#4aa9a9',
          500: '#2d8a8a',
          600: '#216e6e',
          700: '#1d5757',
          800: '#1c4747',
          900: '#1b3b3b',
          950: '#0d2222',
        },
        accent: {
          50: '#fffef7',
          100: '#fffcec',
          200: '#fff7c2',
          300: '#ffed85',
          400: '#ffe347',
          500: '#ffd91a',
          600: '#d4b014',
          700: '#a88811',
          800: '#856812',
          900: '#6b5413',
          950: '#3d2c05',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'base-lg': ['1.125rem', { lineHeight: '1.7' }],
        'lg-xl': ['1.25rem', { lineHeight: '1.7' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [],
}
export default config