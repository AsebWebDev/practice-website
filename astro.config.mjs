import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  build: {
    // The Content-Security-Policy allows only files from the site's own
    // origin, so styles must stay in separate files.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Astro embeds scripts below this size into the HTML, which the
      // Content-Security-Policy would block.
      assetsInlineLimit: 0,
    },
  },
});
