import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Read directly: Playwright loads tests as native modules, and Node only
// imports JSON with an import attribute that the site's code does not use.
const readContent = (file: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'),
  );

type Range = { from: string; to: string };
type Notice = { kind: string; text: string; from?: string; until: string };

export type Content = {
  openingHours: { days: Record<string, Range[]>; note?: string };
  notices: Notice[];
  version: Record<string, string>;
};

export const builtContent: Content = {
  openingHours: readContent('opening-hours.json') as Content['openingHours'],
  notices: readContent('notices.json') as Notice[],
  version: {},
};

/** A Tuesday in December, before the holiday notice in the content starts. */
export const now = new Date('2026-12-01T09:00:00+01:00');

export async function fixClock(page: Page, at = now) {
  await page.clock.setFixedTime(at);
}

/** Answers /.auth/me the way Static Web Apps does. */
export async function signIn(page: Page, roles: string[] | null) {
  await page.route('**/.auth/me', (route) =>
    route.fulfill({
      json: {
        clientPrincipal: roles && {
          identityProvider: 'aad',
          userId: 'test-user',
          userDetails: 'maria@example.com',
          userRoles: ['anonymous', 'authenticated', ...roles],
        },
      },
    }),
  );
}

export type Saved = { body: unknown };

/**
 * Stands in for GET and PUT /api/content. Saves are recorded, and the
 * answer to a save can be set per test.
 */
export async function fakeApi(
  page: Page,
  content: Content = builtContent,
  answerSave: (body: unknown) => { status: number; json: unknown } = (
    body,
  ) => ({
    status: 200,
    json: {
      ...(body as object),
      version: { openingHours: 'v2', notices: 'v2' },
    },
  }),
) {
  const saved: Saved[] = [];

  await page.route('**/api/content', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      return route.fulfill({ json: content });
    }
    const body: unknown = request.postDataJSON();
    saved.push({ body });
    const { status, json } = answerSave(body);
    return route.fulfill({ status, json });
  });

  return saved;
}

export async function expectNoAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22aa',
      'best-practice',
    ])
    .analyze();

  expect(
    result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
  ).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
}
