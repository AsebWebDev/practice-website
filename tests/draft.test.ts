import { readFile } from 'node:fs/promises';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import PracticePage from '../src/components/PracticePage.astro';
import { designs } from '../src/lib/designs.ts';

describe.each(designs)('the draft page in direction $id', ({ id }) => {
  test('says it is a draft and asks search engines to stay away', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PracticePage, {
      props: { design: id },
    });

    expect(html).toContain('Entwurf – keine echte Praxisseite.');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toMatch(/<title>Entwurf: /);
  });
});

test('robots.txt blocks every crawler from every path', async () => {
  const robots = await readFile(
    new URL('../public/robots.txt', import.meta.url),
    'utf8',
  );

  expect(robots).toMatch(/^User-agent: \*$/m);
  expect(robots).toMatch(/^Disallow: \/$/m);
});
