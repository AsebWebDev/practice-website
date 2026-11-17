// Turns the raw values of the editing form into the shape the API expects,
// and back. Kept free of the DOM so it can be tested on its own.

import type { Weekday } from './weekdays.ts';

export type RawRange = { from: string; to: string };

export type RawNotice = {
  kind: string;
  text: string;
  from: string;
  until: string;
};

export type RawForm = {
  days: Record<Weekday, RawRange[]>;
  note: string;
  notices: RawNotice[];
};

/** Empty optional fields are left out, as the schema expects. */
export function toPayload(form: RawForm) {
  const note = form.note.trim();

  return {
    openingHours: {
      days: form.days,
      ...(note ? { note } : {}),
    },
    notices: form.notices.map(({ kind, text, from, until }) => ({
      kind,
      text: text.trim(),
      ...(from ? { from } : {}),
      until,
    })),
  };
}

export type Issue = { path: PropertyKey[]; message: string };

/** The dotted path the form uses to find the field an issue belongs to. */
export function issuePath(issue: Issue): string {
  return issue.path.map(String).join('.');
}
