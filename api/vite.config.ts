import { readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

const functions = readdirSync(new URL('src/functions', import.meta.url))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => `src/functions/${file}`);

export default defineConfig({
  build: {
    // Each function becomes one self-contained file. The deployment then
    // needs no node_modules, which pnpm's linked layout would break.
    ssr: true,
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: functions,
      // Provided by the Azure Functions host at runtime.
      external: ['@azure/functions-core'],
      output: {
        entryFileNames: 'functions/[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
});
