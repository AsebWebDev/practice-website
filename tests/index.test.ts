import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, test } from 'vitest';
import { practice, services } from '../src/content';
import Index from '../src/pages/index.astro';

let html: string;

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(Index);
});

describe('the start page', () => {
  test('declares German as its language', () => {
    expect(html).toMatch(/<html lang="de"[ >]/);
  });

  test('has exactly one main heading, the practice name', () => {
    const mainHeadings = html.match(/<h1[\s>]/g) ?? [];

    expect(mainHeadings).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>\\s*${practice.name}\\s*</h1>`));
  });

  test('offers a phone link that dials the number', () => {
    expect(html).toContain(`href="tel:${practice.phone.international}"`);
    expect(html).toContain(practice.phone.display);
  });

  test('offers an email link', () => {
    expect(html).toContain(`href="mailto:${practice.email}"`);
  });

  test('lists opening hours for all seven weekdays', () => {
    const rows = html.match(/<tr[^>]*data-weekday="/g) ?? [];

    expect(rows).toHaveLength(7);
    expect(html).toContain('8:00–12:00 Uhr');
    expect(html).toContain('geschlossen');
  });

  test('shows every service', () => {
    for (const service of services) {
      expect(html).toContain(service.title);
    }
  });

  test.each(['oeffnungszeiten', 'leistungen', 'praxis', 'kontakt'])(
    'has a labelled section "%s"',
    (id) => {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`aria-labelledby="${id}-heading"`);
      expect(html).toContain(`id="${id}-heading"`);
    },
  );
});
