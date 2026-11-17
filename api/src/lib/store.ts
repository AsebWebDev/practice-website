import { TableClient } from '@azure/data-tables';

export type ContentKey = 'openingHours' | 'notices';

export type StoredContent = Partial<Record<ContentKey, unknown>>;

/** Where the editable content lives. Tests use an in-memory version. */
export interface ContentStore {
  read(): Promise<StoredContent>;
  write(content: Record<ContentKey, unknown>): Promise<void>;
}

const tableName = 'content';
const partitionKey = 'site';

type ContentEntity = {
  partitionKey: string;
  rowKey: ContentKey;
  json: string;
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
        // Fail fast: the site falls back to its built content, and a person
        // saving would rather see an error than wait.
        retryOptions: {
          maxRetries: 2,
          retryDelayInMs: 200,
          maxRetryDelayInMs: 1000,
        },
      }),
    );
  }

  read(): Promise<StoredContent> {
    return this.withTable(async () => {
      const content: StoredContent = {};

      const rows = this.client.listEntities<ContentEntity>({
        queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
      });

      for await (const row of rows) {
        if (row.rowKey !== 'openingHours' && row.rowKey !== 'notices') continue;
        try {
          content[row.rowKey] = JSON.parse(row.json);
        } catch {
          // A damaged row is left out, so only this part falls back to the
          // built content and the other part still shows what was saved.
        }
      }

      return content;
    });
  }

  write(content: Record<ContentKey, unknown>): Promise<void> {
    return this.withTable(async () => {
      await this.client.submitTransaction(
        (Object.keys(content) as ContentKey[]).map((rowKey) => [
          'upsert',
          {
            partitionKey,
            rowKey,
            json: JSON.stringify(content[rowKey]),
          } satisfies ContentEntity,
          'Replace',
        ]),
      );
    });
  }

  /**
   * Runs an operation once the table exists. A failed creation is not
   * remembered, and a table that went missing is created again, so one
   * hiccup does not break saving until the function restarts.
   */
  private async withTable<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.ensureTable();
      return await operation();
    } catch (error) {
      this.tableReady = undefined;
      if (!isTableMissing(error)) throw error;

      await this.ensureTable();
      return operation();
    }
  }

  private ensureTable(): Promise<void> {
    // createTable succeeds without change when the table already exists.
    this.tableReady ??= this.client.createTable();
    return this.tableReady;
  }
}

function isTableMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    error.statusCode === 404
  );
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
