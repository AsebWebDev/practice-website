import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { findInlineCode } from './inline-code.ts';

const dist = join(import.meta.dirname, '..', 'dist');

const entries = await readdir(dist, { recursive: true });
const pages = entries.filter((entry) => entry.endsWith('.html'));

if (pages.length === 0) {
  console.error('No HTML files in dist/. Run the build first.');
  process.exit(1);
}

let failed = false;

for (const page of pages) {
  const path = join(dist, page);
  const findings = findInlineCode(await readFile(path, 'utf8'));

  for (const finding of findings) {
    failed = true;
    console.error(
      `${relative(process.cwd(), path)}: inline ${finding.kind}: ${finding.snippet}`,
    );
  }
}

if (failed) {
  console.error(
    "\nInline code breaks the Content-Security-Policy (default-src 'self').",
  );
  process.exit(1);
}

console.log(`No inline code in ${pages.length} HTML file(s).`);
