import { weekdays, type Weekday } from './weekdays.ts';

// The practice is in Germany, so "today" means today there, wherever the
// build server or the visitor's phone happens to be.
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'long',
});

export type Today = {
  /** Calendar date as YYYY-MM-DD, which sorts correctly as plain text. */
  date: string;
  weekday: Weekday;
};

export function berlinToday(now: Date): Today {
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const weekday = weekdays.find((day) => day === parts.weekday?.toLowerCase());

  if (!weekday) {
    throw new Error(`Unexpected weekday "${parts.weekday}"`);
  }

  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday };
}

type NoticePeriod = { from?: string | undefined; until: string };

/** A notice shows from its start date through the end of its last day. */
export function isNoticeActive(notice: NoticePeriod, date: string): boolean {
  return (!notice.from || notice.from <= date) && date <= notice.until;
}

export function isNoticeExpired(notice: NoticePeriod, date: string): boolean {
  return notice.until < date;
}
