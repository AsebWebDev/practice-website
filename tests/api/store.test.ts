import { describe, expect, test, vi } from 'vitest';
import { TableContentStore } from '../../api/src/lib/store.ts';

const notFound = Object.assign(new Error('TableNotFound'), { statusCode: 404 });

function fakeClient() {
  return {
    createTable: vi.fn(() => Promise.resolve()),
    submitTransaction: vi.fn(() => Promise.resolve()),
    listEntities: vi.fn(async function* () {
      yield { rowKey: 'notices', json: '[]' };
    }),
  };
}

const store = (client: ReturnType<typeof fakeClient>) =>
  new TableContentStore(
    client as unknown as ConstructorParameters<typeof TableContentStore>[0],
  );

const content = { openingHours: { days: {} }, notices: [] };

describe('TableContentStore', () => {
  test('creates the table once, not on every request', async () => {
    const client = fakeClient();
    const subject = store(client);

    await subject.write(content);
    await subject.read();

    expect(client.createTable).toHaveBeenCalledOnce();
  });

  test('creates a table that went missing and saves anyway', async () => {
    const client = fakeClient();
    const subject = store(client);
    await subject.read();
    client.submitTransaction.mockRejectedValueOnce(notFound);

    await subject.write(content);

    expect(client.createTable).toHaveBeenCalledTimes(2);
    expect(client.submitTransaction).toHaveBeenCalledTimes(2);
  });

  test('tries to create the table again after a failed attempt', async () => {
    const client = fakeClient();
    client.createTable.mockRejectedValueOnce(new Error('network down'));
    const subject = store(client);

    await expect(subject.read()).rejects.toThrow('network down');
    await expect(subject.read()).resolves.toEqual({ notices: [] });
    expect(client.createTable).toHaveBeenCalledTimes(2);
  });

  test('passes on other errors without retrying', async () => {
    const client = fakeClient();
    client.submitTransaction.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), { statusCode: 403 }),
    );

    await expect(store(client).write(content)).rejects.toThrow('Forbidden');
    expect(client.submitTransaction).toHaveBeenCalledOnce();
  });

  test('leaves out a damaged row and keeps the other part', async () => {
    const client = fakeClient();
    client.listEntities.mockImplementation(async function* () {
      yield { rowKey: 'openingHours', json: '{broken' };
      yield { rowKey: 'notices', json: '[]' };
    });

    await expect(store(client).read()).resolves.toEqual({ notices: [] });
  });
});
