import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // The same build runs on different hosts: the preview lives in a
  // sub-folder of GitHub Pages, the final site at the root of its own
  // domain. The deploy workflow sets both values; locally they stay unset.
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH ?? '/',
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
