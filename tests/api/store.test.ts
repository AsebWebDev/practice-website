import { describe, expect, test, vi } from 'vitest';
import { ConflictError, TableContentStore } from '../../api/src/lib/store.ts';

// Shapes of the errors the table answers with, as seen against Azurite.
const tableMissing = Object.assign(new Error('TableNotFound'), {
  statusCode: 404,
  code: 'TableNotFound',
});
const tableMissingWithoutCode = Object.assign(
  new Error('{"odata.error":{"code":"TableNotFound"}}'),
  { statusCode: 404 },
);
const staleVersion = Object.assign(new Error('UpdateConditionNotSatisfied'), {
  statusCode: 412,
  code: 'UpdateConditionNotSatisfied',
});
const alreadyExists = Object.assign(new Error('EntityAlreadyExists'), {
  statusCode: 409,
  code: 'EntityAlreadyExists',
});
const rowDeleted = Object.assign(new Error('ResourceNotFound'), {
  statusCode: 404,
  code: 'ResourceNotFound',
});

function fakeClient() {
  return {
    createTable: vi.fn(() => Promise.resolve()),
    submitTransaction: vi.fn((actions: unknown[]) =>
      Promise.resolve({
        subResponses: actions.map((_, index) => ({ etag: `new-${index}` })),
      }),
    ),
    listEntities: vi.fn(async function* () {
      yield { rowKey: 'notices', json: '[]', etag: 'n1' };
    }),
  };
}

const store = (client: ReturnType<typeof fakeClient>) =>
  new TableContentStore(
    client as unknown as ConstructorParameters<typeof TableContentStore>[0],
  );

const content = { openingHours: { days: {} }, notices: [] };

describe('TableContentStore', () => {
  test('reads each part with its version', async () => {
    await expect(store(fakeClient()).read()).resolves.toEqual({
      content: { notices: [] },
      version: { notices: 'n1' },
    });
  });

  test('replaces a part only at the version it was read, and creates a new one', async () => {
    const client = fakeClient();

    const version = await store(client).write(content, { notices: 'n1' });

    expect(client.submitTransaction).toHaveBeenCalledWith([
      ['create', expect.objectContaining({ rowKey: 'openingHours' })],
      [
        'update',
        expect.objectContaining({ rowKey: 'notices' }),
        'Replace',
        { etag: 'n1' },
      ],
    ]);
    expect(version).toEqual({ openingHours: 'new-0', notices: 'new-1' });
  });

  test.each([
    ['a stale version', staleVersion],
    ['a part someone else created', alreadyExists],
    ['a part someone else deleted', rowDeleted],
  ])('reports %s as a conflict', async (_, error) => {
    const client = fakeClient();
    client.submitTransaction.mockRejectedValueOnce(error);

    await expect(store(client).write(content, {})).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test('creates the table once, not on every request', async () => {
    const client = fakeClient();
    const subject = store(client);

    await subject.write(content, {});
    await subject.read();

    expect(client.createTable).toHaveBeenCalledOnce();
  });

  test.each([
    ['with an error code', tableMissing],
    ['with the code only in the message', tableMissingWithoutCode],
  ])(
    'creates a table that went missing and saves anyway (%s)',
    async (_, error) => {
      const client = fakeClient();
      const subject = store(client);
      await subject.read();
      client.submitTransaction.mockRejectedValueOnce(error);

      await subject.write(content, {});

      expect(client.createTable).toHaveBeenCalledTimes(2);
      expect(client.submitTransaction).toHaveBeenCalledTimes(2);
    },
  );

  test('tries to create the table again after a failed attempt', async () => {
    const client = fakeClient();
    client.createTable.mockRejectedValueOnce(new Error('network down'));
    const subject = store(client);

    await expect(subject.read()).rejects.toThrow('network down');
    await expect(subject.read()).resolves.toMatchObject({
      content: { notices: [] },
    });
    expect(client.createTable).toHaveBeenCalledTimes(2);
  });

  test('passes on other errors without retrying', async () => {
    const client = fakeClient();
    client.submitTransaction.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { statusCode: 403 }),
    );

    await expect(store(client).write(content, {})).rejects.toThrow('Forbidden');
    expect(client.submitTransaction).toHaveBeenCalledOnce();
  });

  test('leaves out a damaged row and keeps the other part', async () => {
    const client = fakeClient();
    client.listEntities.mockImplementation(async function* () {
      yield { rowKey: 'openingHours', json: '{broken', etag: 'h1' };
      yield { rowKey: 'notices', json: '[]', etag: 'n1' };
    });

    await expect(store(client).read()).resolves.toMatchObject({
      content: { notices: [] },
    });
  });
});
