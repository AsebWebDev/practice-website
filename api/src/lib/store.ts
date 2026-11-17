import { TableClient } from '@azure/data-tables';

export type ContentKey = 'openingHours' | 'notices';

export type StoredContent = Partial<Record<ContentKey, unknown>>;

/**
 * Which state of each part someone has seen, as the table's own version
 * tags (ETags). A part that was never saved has no entry.
 */
export type Version = Partial<Record<ContentKey, string>>;

/** Someone else saved since the given version was read. */
export class ConflictError extends Error {
  constructor() {
    super('The content changed since it was read.');
    this.name = 'ConflictError';
  }
}

/** Where the editable content lives. Tests use an in-memory version. */
export interface ContentStore {
  read(): Promise<{ content: StoredContent; version: Version }>;
  /**
   * Saves both parts, but only if they are still at the given version;
   * otherwise throws ConflictError. Returns the new version.
   */
  write(
    content: Record<ContentKey, unknown>,
    version: Version,
  ): Promise<Version>;
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

  read(): Promise<{ content: StoredContent; version: Version }> {
    return this.withTable(async () => {
      const content: StoredContent = {};
      const version: Version = {};

      const rows = this.client.listEntities<ContentEntity>({
        queryOptions: { filter: `PartitionKey eq '${partitionKey}'` },
      });

      for await (const row of rows) {
        if (row.rowKey !== 'openingHours' && row.rowKey !== 'notices') continue;
        version[row.rowKey] = row.etag;
        try {
          content[row.rowKey] = JSON.parse(row.json);
        } catch {
          // A damaged row is left out, so only this part falls back to the
          // built content and the other part still shows what was saved.
        }
      }

      return { content, version };
    });
  }

  write(
    content: Record<ContentKey, unknown>,
    version: Version,
  ): Promise<Version> {
    const keys = Object.keys(content) as ContentKey[];

    return this.withTable(async () => {
      try {
        // Both parts change together or not at all. A part that has a
        // version is only replaced if it is still at that version; a part
        // without one is only created if nobody created it meanwhile.
        const response = await this.client.submitTransaction(
          keys.map((rowKey) => {
            const entity: ContentEntity = {
              partitionKey,
              rowKey,
              json: JSON.stringify(content[rowKey]),
            };
            const etag = version[rowKey];
            return etag
              ? ['update', entity, 'Replace', { etag }]
              : ['create', entity];
          }),
        );

        // Answers to an update do not name their row, so the new versions
        // are taken in the order of the actions.
        return Object.fromEntries(
          keys.map((rowKey, index) => [
            rowKey,
            response.subResponses[index]?.etag,
          ]),
        ) as Version;
      } catch (error) {
        if (isConflict(error)) throw new ConflictError();
        throw error;
      }
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

function errorDetails(error: unknown): { status?: unknown; code?: unknown } {
  if (typeof error !== 'object' || error === null) return {};
  const message = 'message' in error ? String(error.message) : '';
  return {
    status: 'statusCode' in error ? error.statusCode : undefined,
    // Some answers carry the error code only inside the message text.
    code:
      'code' in error && error.code
        ? error.code
        : message.includes('TableNotFound')
          ? 'TableNotFound'
          : undefined,
  };
}

function isTableMissing(error: unknown): boolean {
  const { status, code } = errorDetails(error);
  return status === 404 && code === 'TableNotFound';
}

/**
 * The table refuses a conditional write with 412 when the row changed, with
 * 409 when a row to be created already exists, and with 404 when a row to
 * be replaced was deleted. Each means someone else saved in between.
 */
function isConflict(error: unknown): boolean {
  const { status, code } = errorDetails(error);
  return (
    status === 412 ||
    status === 409 ||
    (status === 404 && code !== 'TableNotFound')
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
