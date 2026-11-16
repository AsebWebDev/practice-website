import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, test, vi } from 'vitest';
import Index from '../src/pages/index.astro';

async function renderAt(iso: string): Promise<string> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));

  const container = await AstroContainer.create();
  return container.renderToString(Index);
}

const currentRows = (html: string) =>
  [...html.matchAll(/<tr[^>]*>/g)]
    .map(([row]) => row)
    .filter((row) => row.includes('aria-current="date"'));

afterEach(() => {
  vi.useRealTimers();
});

describe('the start page at build time', () => {
  test('marks the weekday it is in Germany, and only that one', async () => {
    // Monday 23:30 UTC is already Tuesday in Berlin.
    const rows = currentRows(await renderAt('2026-11-16T23:30:00Z'));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('data-weekday="tuesday"');
  });

  test('shows the holiday notice while it runs', async () => {
    const html = await renderAt('2026-12-24T10:00:00Z');

    expect(html).toContain('data-notices');
    expect(html).toMatch(/<li[^>]*data-notice-until="2027-01-02"[^>]*>/);
    expect(html).not.toMatch(/<aside[^>]*\shidden/);
  });

  test('leaves the notice out once its last day has passed', async () => {
    const html = await renderAt('2027-01-03T10:00:00Z');

    expect(html).not.toContain('data-notices');
    expect(html).not.toContain('23. Dezember');
  });

  test('ships a notice that starts later, but hidden', async () => {
    const html = await renderAt('2026-10-15T10:00:00Z');

    expect(html).toMatch(/<aside[^>]*\shidden/);
    expect(html).toMatch(/<li[^>]*\shidden[^>]*>/);
  });
});
