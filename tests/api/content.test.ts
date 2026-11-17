import { describe, expect, test, vi } from 'vitest';
import {
  getContent,
  saveContent,
  type Request,
} from '../../api/src/handlers/content.ts';
import type {
  ContentKey,
  ContentStore,
  StoredContent,
} from '../../api/src/lib/store.ts';
import { notices, openingHours } from '../../src/content';

class MemoryStore implements ContentStore {
  content: StoredContent = {};
  editors: string[] = [];

  async read() {
    return structuredClone(this.content);
  }

  async write(content: Record<ContentKey, unknown>, editor: string) {
    this.content = structuredClone(content);
    this.editors.push(editor);
  }
}

const log = { error: vi.fn() };

const principal = (roles: string[]) =>
  Buffer.from(
    JSON.stringify({
      identityProvider: 'aad',
      userId: 'u1',
      userDetails: 'praxis@example.com',
      userRoles: ['anonymous', 'authenticated', ...roles],
    }),
  ).toString('base64');

function request(body: unknown, header?: string): Request {
  return {
    headers: {
      get: (name) =>
        name === 'x-ms-client-principal' ? (header ?? null) : null,
    },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const newHours = {
  ...openingHours,
  days: { ...openingHours.days, saturday: [{ from: '09:00', to: '12:00' }] },
};

const newNotices = [
  { kind: 'info', text: 'Neue Telefonnummer ab Januar', until: '2027-02-01' },
];

const valid = { openingHours: newHours, notices: newNotices };

describe('reading', () => {
  test('falls back to the built content when nothing is stored', async () => {
    const response = await getContent(new MemoryStore(), log);

    expect(response.jsonBody).toEqual({ openingHours, notices });
    expect(response.headers).toEqual({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
  });

  test('falls back when no store is configured', async () => {
    const response = await getContent(undefined, log);

    expect(response.jsonBody).toEqual({ openingHours, notices });
  });

  test('falls back when the store cannot be reached, and logs it', async () => {
    const broken: ContentStore = {
      read: () => Promise.reject(new Error('offline')),
      write: () => Promise.resolve(),
    };
    log.error.mockClear();

    const response = await getContent(broken, log);

    expect(response.jsonBody).toEqual({ openingHours, notices });
    expect(log.error).toHaveBeenCalledOnce();
  });

  test('falls back per part when a stored part is invalid', async () => {
    const store = new MemoryStore();
    store.content = { openingHours: { days: 'broken' }, notices: newNotices };

    const response = await getContent(store, log);

    expect(response.jsonBody).toEqual({ openingHours, notices: newNotices });
  });
});

describe('saving', () => {
  test('rejects a visitor who is not signed in', async () => {
    const store = new MemoryStore();
    const response = await saveContent(request(valid), store, log);

    expect(response.status).toBe(401);
    expect(store.editors).toEqual([]);
  });

  test('rejects a signed-in user without the editor role', async () => {
    const store = new MemoryStore();
    const response = await saveContent(
      request(valid, principal([])),
      store,
      log,
    );

    expect(response.status).toBe(403);
    expect(store.editors).toEqual([]);
  });

  test('treats a forged, unreadable header as not signed in', async () => {
    const response = await saveContent(
      request(valid, 'not-base64-json'),
      new MemoryStore(),
      log,
    );

    expect(response.status).toBe(401);
  });

  test('stores valid content for an editor and names who saved it', async () => {
    const store = new MemoryStore();
    const response = await saveContent(
      request(valid, principal(['editor'])),
      store,
      log,
    );

    expect(response.status).toBe(200);
    expect(store.editors).toEqual(['praxis@example.com']);

    const read = await getContent(store, log);
    expect(read.jsonBody).toEqual(valid);
  });

  test.each([
    [
      'an impossible time',
      {
        ...valid,
        openingHours: {
          days: { ...newHours.days, monday: [{ from: '25:00', to: '26:00' }] },
        },
      },
    ],
    [
      'a notice that ends before it starts',
      {
        ...valid,
        notices: [
          { kind: 'info', text: 'x', from: '2027-02-02', until: '2027-02-01' },
        ],
      },
    ],
    ['a missing part', { openingHours: newHours }],
  ])('rejects %s and stores nothing', async (_, body) => {
    const store = new MemoryStore();
    const response = await saveContent(
      request(body, principal(['editor'])),
      store,
      log,
    );

    expect(response.status).toBe(400);
    expect(response.jsonBody).toMatchObject({ error: 'Invalid content.' });
    expect(store.editors).toEqual([]);
  });

  test('rejects a body that is not JSON', async () => {
    const response = await saveContent(
      request('{oops', principal(['editor'])),
      new MemoryStore(),
      log,
    );

    expect(response.status).toBe(400);
  });

  test('rejects an oversized body before parsing it', async () => {
    const response = await saveContent(
      request('x'.repeat(70 * 1024), principal(['editor'])),
      new MemoryStore(),
      log,
    );

    expect(response.status).toBe(413);
  });

  test('answers 503 when no store is configured', async () => {
    const response = await saveContent(
      request(valid, principal(['editor'])),
      undefined,
      log,
    );

    expect(response.status).toBe(503);
  });
});
