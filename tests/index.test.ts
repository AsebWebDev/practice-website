import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, test } from 'vitest';
import Index from '../src/pages/index.astro';

test('the page declares German as its language and names the practice', async () => {
  const container = await AstroContainer.create();
  const html = await container.renderToString(Index);

  expect(html).toContain('<html lang="de">');
  expect(html).toContain('<h1');
  expect(html).toContain('Zahnarztpraxis Maria Schuch');
});
