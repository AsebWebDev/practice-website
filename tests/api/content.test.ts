import { describe, expect, test, vi } from 'vitest';
import {
  getContent,
  saveContent,
  type Request,
} from '../../api/src/handlers/content.ts';
import {
  ConflictError,
  type ContentKey,
  type ContentStore,
  type StoredContent,
  type Version,
} from '../../api/src/lib/store.ts';
import { notices, openingHours } from '../../src/content';

/** Behaves like the table: every save gives each part a new version. */
class MemoryStore implements ContentStore {
  content: StoredContent = {};
  version: Version = {};
  writes = 0;

  async read() {
    return {
      content: structuredClone(this.content),
      version: { ...this.version },
    };
  }

  async write(content: Record<ContentKey, unknown>, version: Version) {
    for (const key of Object.keys(content) as ContentKey[]) {
      if (version[key] !== this.version[key]) throw new ConflictError();
    }
    this.writes += 1;
    this.content = structuredClone(content);
    for (const key of Object.keys(content) as ContentKey[]) {
      this.version[key] = `v${this.writes}`;
    }
    return { ...this.version };
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

function request(body: unknown, header?: string, fetchSite?: string): Request {
  return {
    headers: {
      get: (name) =>
        name === 'x-ms-client-principal'
          ? (header ?? null)
          : name === 'sec-fetch-site'
            ? (fetchSite ?? null)
            : null,
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

const valid = { openingHours: newHours, notices: newNotices, version: {} };

describe('reading', () => {
  test('falls back to the built content when nothing is stored', async () => {
    const response = await getContent(new MemoryStore(), log);

    expect(response.jsonBody).toEqual({ openingHours, notices, version: {} });
    expect(response.headers).toEqual({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
  });

  test('falls back when no store is configured', async () => {
    const response = await getContent(undefined, log);

    expect(response.jsonBody).toEqual({ openingHours, notices, version: {} });
  });

  test('falls back when the store cannot be reached, and logs it', async () => {
    const broken: ContentStore = {
      read: () => Promise.reject(new Error('offline')),
      write: () => Promise.resolve({}),
    };
    log.error.mockClear();

    const response = await getContent(broken, log);

    expect(response.jsonBody).toEqual({ openingHours, notices, version: {} });
    expect(log.error).toHaveBeenCalledOnce();
  });

  test('falls back per part when a stored part is invalid', async () => {
    const store = new MemoryStore();
    store.content = { openingHours: { days: 'broken' }, notices: newNotices };

    const response = await getContent(store, log);

    expect(response.jsonBody).toEqual({
      openingHours,
      notices: newNotices,
      version: {},
    });
  });
});

describe('saving', () => {
  test('rejects a visitor who is not signed in', async () => {
    const store = new MemoryStore();
    const response = await saveContent(request(valid), store, log);

    expect(response.status).toBe(401);
    expect(store.writes).toBe(0);
  });

  test('rejects a signed-in user without the editor role', async () => {
    const store = new MemoryStore();
    const response = await saveContent(
      request(valid, principal([])),
      store,
      log,
    );

    expect(response.status).toBe(403);
    expect(store.writes).toBe(0);
  });

  test('treats a forged, unreadable header as not signed in', async () => {
    const response = await saveContent(
      request(valid, 'not-base64-json'),
      new MemoryStore(),
      log,
    );

    expect(response.status).toBe(401);
  });

  test('stores valid content for an editor', async () => {
    const store = new MemoryStore();
    const response = await saveContent(
      request(valid, principal(['editor'])),
      store,
      log,
    );

    expect(response.status).toBe(200);
    expect(store.writes).toBe(1);

    const saved = {
      openingHours: newHours,
      notices: newNotices,
      version: { openingHours: 'v1', notices: 'v1' },
    };
    expect(response.jsonBody).toEqual(saved);
    expect((await getContent(store, log)).jsonBody).toEqual(saved);
  });

  test('refuses a save based on an older version and keeps the newer one', async () => {
    const store = new MemoryStore();
    const editor = principal(['editor']);

    // Two people open the form while nothing is saved yet.
    const first = await saveContent(request(valid, editor), store, log);
    const second = await saveContent(
      request({ ...valid, notices: [] }, editor),
      store,
      log,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(store.writes).toBe(1);
    expect(store.content.notices).toEqual(newNotices);
  });

  test('accepts the next save from the same person with the new version', async () => {
    const store = new MemoryStore();
    const editor = principal(['editor']);

    const first = await saveContent(request(valid, editor), store, log);
    const { version } = first.jsonBody as { version: object };
    const again = await saveContent(
      request({ ...valid, notices: [], version }, editor),
      store,
      log,
    );

    expect(again.status).toBe(200);
    expect(store.content.notices).toEqual([]);
  });

  test('rejects a save without a version', async () => {
    const response = await saveContent(
      request(
        { openingHours: valid.openingHours, notices: valid.notices },
        principal(['editor']),
      ),
      new MemoryStore(),
      log,
    );

    expect(response.status).toBe(400);
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
    expect(store.writes).toBe(0);
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

  test.each(['cross-site', 'same-site'])(
    'rejects a request a browser sent from another site (%s)',
    async (fetchSite) => {
      const store = new MemoryStore();
      const response = await saveContent(
        request(valid, principal(['editor']), fetchSite),
        store,
        log,
      );

      expect(response.status).toBe(403);
      expect(store.writes).toBe(0);
    },
  );

  test('accepts a request from the editing page itself', async () => {
    const response = await saveContent(
      request(valid, principal(['editor']), 'same-origin'),
      new MemoryStore(),
      log,
    );

    expect(response.status).toBe(200);
  });

  test('rejects a notice text longer than the bar can show', async () => {
    const long = {
      ...valid,
      notices: [{ kind: 'info', text: 'x'.repeat(301), until: '2027-02-01' }],
    };
    const response = await saveContent(
      request(long, principal(['editor'])),
      new MemoryStore(),
      log,
    );

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.jsonBody)).toContain(
      'Bitte höchstens 300 Zeichen.',
    );
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
