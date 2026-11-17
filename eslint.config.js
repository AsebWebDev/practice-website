import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', '.astro/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    // Config files run in Node, not in the browser.
    files: ['*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: { process: 'readonly' },
    },
  },
);
