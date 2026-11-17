import type { HttpResponseInit } from '@azure/functions';
import { notices, openingHours } from '../../../src/content/index.ts';
import {
  editableContentSchema,
  noticesSchema,
  openingHoursSchema,
} from '../../../src/content/schema.ts';
import { isEditor, readPrincipal } from '../lib/principal.ts';
import type { ContentStore } from '../lib/store.ts';

/** The parts of the request the handlers use, so tests need no host. */
export type Request = {
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type Log = { error(...args: unknown[]): void };

// A full week of hours and a long list of notices stay well below this.
const maxBodyBytes = 64 * 1024;

// Static Web Apps does not add its global headers to API responses.
const noStore = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

/**
 * The current opening hours and notices. Each part falls back to what the
 * site was built with when the store has nothing valid for it or cannot be
 * reached, so the site never shows less than before.
 */
export async function getContent(
  store: ContentStore | undefined,
  log: Log,
): Promise<HttpResponseInit> {
  let stored: Awaited<ReturnType<ContentStore['read']>> = {};

  if (store) {
    try {
      stored = await store.read();
    } catch (error) {
      log.error('Reading the content store failed', error);
    }
  }

  const storedHours = openingHoursSchema.safeParse(stored.openingHours);
  const storedNotices = noticesSchema.safeParse(stored.notices);

  return {
    jsonBody: {
      openingHours: storedHours.success ? storedHours.data : openingHours,
      notices: storedNotices.success ? storedNotices.data : notices,
    },
    headers: noStore,
  };
}

/** Saves opening hours and notices. Only for users with the editor role. */
export async function saveContent(
  request: Request,
  store: ContentStore | undefined,
  log: Log,
): Promise<HttpResponseInit> {
  const principal = readPrincipal(request.headers);

  if (!principal) {
    return { status: 401, jsonBody: { error: 'Not signed in.' } };
  }
  if (!isEditor(principal)) {
    return { status: 403, jsonBody: { error: 'Not allowed to edit.' } };
  }
  if (!store) {
    log.error('CONTENT_STORAGE is not set, so nothing can be saved');
    return { status: 503, jsonBody: { error: 'Saving is not set up.' } };
  }

  const body = await request.text();

  if (Buffer.byteLength(body, 'utf8') > maxBodyBytes) {
    return { status: 413, jsonBody: { error: 'Too much data.' } };
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return { status: 400, jsonBody: { error: 'Not valid JSON.' } };
  }

  const parsed = editableContentSchema.safeParse(data);

  if (!parsed.success) {
    return {
      status: 400,
      jsonBody: {
        error: 'Invalid content.',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
    };
  }

  try {
    await store.write(parsed.data, principal.userDetails || principal.userId);
  } catch (error) {
    log.error('Writing the content store failed', error);
    return { status: 502, jsonBody: { error: 'Saving failed.' } };
  }

  return { status: 200, jsonBody: parsed.data, headers: noStore };
}
