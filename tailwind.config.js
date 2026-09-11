import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // La app alterna la clase `dark` en <html> (ver contexts/AppContext).
  darkMode: 'class',
  theme: {
    extend: {},
  },
  // Mismos plugins que traía el CDN: ?plugins=forms,container-queries
  plugins: [forms, containerQueries],
};
