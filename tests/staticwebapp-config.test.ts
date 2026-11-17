import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

type Route = {
  route: string;
  methods?: string[];
  allowedRoles?: string[];
  statusCode?: number;
};

const config = JSON.parse(
  await readFile(
    new URL('../public/staticwebapp.config.json', import.meta.url),
    'utf8',
  ),
) as {
  routes: Route[];
  responseOverrides: Record<string, { rewrite?: string; redirect?: string }>;
  globalHeaders: Record<string, string>;
};

const route = (path: string) =>
  config.routes.find((entry) => entry.route === path);

describe('access rules', () => {
  // Microsoft documents that a folder rule does not cover its index.html and
  // that /pflege* covers everything. The local emulator only honours some of
  // these forms, so all three are listed; each one requires the same role.
  test.each(['/pflege/index.html', '/pflege/*', '/pflege*'])(
    '%s is only for editors',
    (path) => {
      expect(route(path)?.allowedRoles).toEqual(['editor']);
    },
  );

  test('no rule under /pflege grants anything else', () => {
    for (const entry of config.routes.filter((r) =>
      r.route.startsWith('/pflege'),
    )) {
      expect(entry.allowedRoles).toEqual(['editor']);
    }
  });

  test('only editors may change content through the api', () => {
    const rule = route('/api/content');

    expect(rule?.allowedRoles).toEqual(['editor']);
    expect(rule?.methods).toEqual(
      expect.arrayContaining(['PUT', 'POST', 'PATCH', 'DELETE']),
    );
    expect(rule?.methods).not.toContain('GET');
  });

  test('sign-in with GitHub is switched off', () => {
    expect(route('/.auth/login/github')?.statusCode).toBe(404);
  });

  test('signed-out visitors go to the Microsoft sign-in', () => {
    expect(config.responseOverrides['401']?.redirect).toMatch(
      /^\/\.auth\/login\/aad\b/,
    );
  });

  test.each([
    ['403', '/kein-zugriff/', '../src/pages/kein-zugriff.astro'],
    ['404', '/404.html', '../src/pages/404.astro'],
  ])('a %s shows a page that exists', async (status, rewrite, source) => {
    expect(config.responseOverrides[status]?.rewrite).toBe(rewrite);
    await expect(
      readFile(new URL(source, import.meta.url)),
    ).resolves.toBeTruthy();
  });
});

describe('security headers', () => {
  const csp = config.globalHeaders['Content-Security-Policy'] ?? '';

  test.each([
    "default-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ])('the Content-Security-Policy contains %s', (directive) => {
    expect(csp.split(/;\s*/)).toContain(directive);
  });

  test('the Content-Security-Policy allows nothing inline or from elsewhere', () => {
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
  });

  test.each([
    ['Strict-Transport-Security', /^max-age=\d{8,}/],
    ['X-Content-Type-Options', /^nosniff$/],
    ['Referrer-Policy', /^no-referrer$/],
  ])('%s is set', (header, value) => {
    expect(config.globalHeaders[header]).toMatch(value);
  });
});
