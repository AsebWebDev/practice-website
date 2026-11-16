import { expect, test } from 'vitest';
import { findInlineCode } from '../scripts/inline-code.ts';

const kinds = (html: string) => findInlineCode(html).map((f) => f.kind);

test('accepts external scripts and stylesheets', () => {
  const html = `
    <link rel="stylesheet" href="/_astro/index.css">
    <script type="module" src="/_astro/index.js"></script>
    <p class="styled">Praxis</p>`;

  expect(findInlineCode(html)).toEqual([]);
});

test('reports a script without src', () => {
  expect(kinds('<script type="module">run()</script>')).toEqual(['script']);
});

test('accepts JSON data blocks, which are not executed', () => {
  expect(
    kinds('<script type="application/ld+json">{"@type":"Dentist"}</script>'),
  ).toEqual([]);
});

test('reports style elements and style attributes', () => {
  expect(
    kinds('<style>p{color:red}</style><p style="color:red">x</p>'),
  ).toEqual(['style element', 'style attribute']);
});

test('reports inline event handlers', () => {
  expect(kinds('<button onclick="go()">Anrufen</button>')).toEqual([
    'event handler',
  ]);
});

test('does not mistake attribute names that only contain "style" or "on"', () => {
  expect(kinds('<p data-style="a" data-on="b" content="x">x</p>')).toEqual([]);
});
