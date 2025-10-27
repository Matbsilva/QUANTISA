import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./App.tsx",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#4f46e5', // Indigo-600
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        neutral: '#64748B',
        'light-bg': '#F8FAFC',
      },
    },
  },
  plugins: [
    // FIX: Replaced require() with an ES module import to be compatible with TypeScript.
    typography,
  ],
};
export default config;
