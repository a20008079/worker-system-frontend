// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        accent: '#f97316',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
};

export default config;
