import { expect, test, vi } from 'vitest';
import { notices, openingHours } from '../../src/content';

// Registering a function needs the Azure Functions host, which is not
// there in tests. The handler itself is plain code.
vi.mock('@azure/functions', () => ({ app: { http: vi.fn() } }));

const { getContent } = await import('../../api/src/functions/content.ts');

test('returns the opening hours and notices, never cached', async () => {
  const response = await getContent();

  expect(response.jsonBody).toEqual({ openingHours, notices });
  expect(response.headers).toEqual({ 'cache-control': 'no-store' });
});
