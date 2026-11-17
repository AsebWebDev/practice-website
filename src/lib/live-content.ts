// Checks what /api/content returned before the page uses it. The public
// page does without the schema library to stay small, so this is a plain
// structural check; the API has already validated the content in full.

import { weekdays, type Weekday } from './weekdays.ts';

export type LiveRange = { from: string; to: string };

export type LiveNotice = {
  kind: string;
  text: string;
  from?: string;
  until: string;
};

export type LiveContent = {
  openingHours: { days: Record<Weekday, LiveRange[]>; note?: string };
  notices: LiveNotice[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isRange = (value: unknown): value is LiveRange =>
  isObject(value) && isString(value.from) && isString(value.to);

const isNotice = (value: unknown): value is LiveNotice =>
  isObject(value) &&
  isString(value.kind) &&
  isString(value.text) &&
  isString(value.until) &&
  (value.from === undefined || isString(value.from));

export function isLiveContent(value: unknown): value is LiveContent {
  if (!isObject(value) || !isObject(value.openingHours)) return false;

  const { days, note } = value.openingHours;

  return (
    isObject(days) &&
    weekdays.every(
      (day) => Array.isArray(days[day]) && days[day].every(isRange),
    ) &&
    (note === undefined || isString(note)) &&
    Array.isArray(value.notices) &&
    value.notices.every(isNotice)
  );
}
