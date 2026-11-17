import { TableClient } from '@azure/data-tables';

export type ContentKey = 'openingHours' | 'notices';

export type StoredContent = Partial<Record<ContentKey, unknown>>;

/** Where the editable content lives. Tests use an in-memory version. */
export interface ContentStore {
  read(): Promise<StoredContent>;
  write(content: Record<ContentKey, unknown>, editor: string): Promise<void>;
}

const tableName = 'content';
const partitionKey = 'site';

type ContentEntity = {
  partitionKey: string;
  rowKey: ContentKey;
  json: string;
  updatedBy: string;
};

/**
 * One table row per content part, holding the JSON as text. The data is a
 * few kilobytes, far below the 64 KiB a string property may hold.
 */
export class TableContentStore implements ContentStore {
  private tableReady: Promise<void> | undefined;

  constructor(private readonly client: TableClient) {}

  static fromConnectionString(connectionString: string): TableContentStore {
    return new TableContentStore(
      TableClient.fromConnectionString(connectionString, tableName, {
        // Azurite, the local stand-in for Table Storage, speaks plain HTTP.
        allowInsecureConnection: connectionString.includes(
          'TableEndpoint=http://',
        ),
      }),
    );
  }

  async read(): Promise<StoredContent> {
    await this.ensureTable();
    const content: StoredContent = {};

    const rows = this.client.listEntities<ContentEntity>({
      queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
    });

    for await (const row of rows) {
      if (row.rowKey === 'openingHours' || row.rowKey === 'notices') {
        content[row.rowKey] = JSON.parse(row.json);
      }
    }

    return content;
  }

  async write(
    content: Record<ContentKey, unknown>,
    editor: string,
  ): Promise<void> {
    await this.ensureTable();

    await this.client.submitTransaction(
      (Object.keys(content) as ContentKey[]).map((rowKey) => [
        'upsert',
        {
          partitionKey,
          rowKey,
          json: JSON.stringify(content[rowKey]),
          updatedBy: editor,
        } satisfies ContentEntity,
        'Replace',
      ]),
    );
  }

  private ensureTable(): Promise<void> {
    this.tableReady ??= this.client.createTable();
    return this.tableReady;
  }
}

let defaultStore: ContentStore | undefined;

/**
 * The store configured for this deployment, or none when the setting is
 * missing. Without a store the site shows the content it was built with.
 */
export function getStore(): ContentStore | undefined {
  const connectionString = process.env.CONTENT_STORAGE;
  if (!connectionString) return undefined;

  defaultStore ??= TableContentStore.fromConnectionString(connectionString);
  return defaultStore;
}
