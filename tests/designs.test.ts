import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, test } from 'vitest';
import PracticePage from '../src/components/PracticePage.astro';
import { designs, sitePath } from '../src/lib/designs.ts';

describe('sitePath', () => {
  test('links from the root of the host', () => {
    expect(sitePath('', '/')).toBe('/');
    expect(sitePath('b/', '/')).toBe('/b/');
  });

  test('links from a sub-folder, with or without a trailing slash', () => {
    expect(sitePath('', '/practice-website')).toBe('/practice-website/');
    expect(sitePath('b/', '/practice-website/')).toBe('/practice-website/b/');
  });
});

describe.each(designs)('design direction $id', ({ id }) => {
  test('is set on the page and marked as current in the switcher', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PracticePage, {
      props: { design: id },
    });

    expect(html).toContain(`<html lang="de" data-design="${id}">`);

    const current = [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)];

    expect(current).toHaveLength(1);
    expect(current[0]?.[0]).toContain(
      `href="${sitePath(designs.find((d) => d.id === id)!.path)}"`,
    );
  });

  test('links to all three directions', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PracticePage, {
      props: { design: id },
    });

    for (const design of designs) {
      expect(html).toContain(`href="${sitePath(design.path)}"`);
    }
  });
});
