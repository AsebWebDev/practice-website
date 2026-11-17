import type { HttpResponseInit } from '@azure/functions';
import { z } from 'zod';
import { notices, openingHours } from '../../../src/content/index.ts';
import {
  editableContentSchema,
  noticesSchema,
  openingHoursSchema,
} from '../../../src/content/schema.ts';
import { isEditor, readPrincipal } from '../lib/principal.ts';
import {
  ConflictError,
  type ContentStore,
  type Version,
} from '../lib/store.ts';

/** The parts of the request the handlers use, so tests need no host. */
export type Request = {
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

export type Log = { error(...args: unknown[]): void };

// A full week of hours and a long list of notices stay well below this.
const maxBodyBytes = 64 * 1024;

// Static Web Apps does not add its global headers to API responses.
/**
 * What the editing page sends: the content plus the version it started
 * from, so a save can be refused when someone else saved in between.
 */
const saveRequestSchema = editableContentSchema.extend({
  version: z.object({
    openingHours: z.string().optional(),
    notices: z.string().optional(),
  }),
});

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
  let stored: Awaited<ReturnType<ContentStore['read']>>['content'] = {};
  let version: Version = {};

  if (store) {
    try {
      ({ content: stored, version } = await store.read());
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
      version,
    },
    headers: noStore,
  };
}

/**
 * Whether a browser sent this request on behalf of another website, as in a
 * cross-site request forgery. Browsers mark every request with the
 * Sec-Fetch-Site header; requests without it do not come from a page and
 * cannot carry the editor's sign-in cookie by accident.
 *
 * Saving with PUT already needs a CORS preflight that Static Web Apps does
 * not answer, so this is a second, explicit line of defence.
 */
function isCrossSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  return site !== null && site !== 'same-origin';
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
  if (isCrossSite(request)) {
    return { status: 403, jsonBody: { error: 'Request from another site.' } };
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

  const parsed = saveRequestSchema.safeParse(data);

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

  const { version, ...content } = parsed.data;
  let newVersion: Version;

  try {
    newVersion = await store.write(content, version);
  } catch (error) {
    if (error instanceof ConflictError) {
      return {
        status: 409,
        jsonBody: { error: 'Someone else saved in the meantime.' },
      };
    }
    log.error('Writing the content store failed', error);
    return { status: 502, jsonBody: { error: 'Saving failed.' } };
  }

  return {
    status: 200,
    jsonBody: { ...content, version: newVersion },
    headers: noStore,
  };
}
