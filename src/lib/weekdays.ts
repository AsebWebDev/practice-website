// Kept free of imports because the browser script uses this list too, and
// it should not pull the schema library into the page.
export const weekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof weekdays)[number];
