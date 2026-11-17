import {
  noticesSchema,
  openingHoursSchema,
  type Notice,
  type OpeningHours,
} from '../src/content/schema.ts';

export type LiveParts = {
  openingHours?: OpeningHours;
  notices?: Notice[];
};

/**
 * Picks the parts of an /api/content answer that pass the same checks as
 * the content files. A part that fails is left out, so the build keeps
 * the version from the repository for it.
 */
export function validLiveParts(body: unknown): LiveParts {
  if (typeof body !== 'object' || body === null) return {};

  const record = body as Record<string, unknown>;
  const hours = openingHoursSchema.safeParse(record.openingHours);
  const notices = noticesSchema.safeParse(record.notices);

  return {
    ...(hours.success ? { openingHours: hours.data } : {}),
    ...(notices.success ? { notices: notices.data } : {}),
  };
}
