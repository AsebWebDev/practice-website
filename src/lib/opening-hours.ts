import type { TimeRange } from '../content/schema.ts';
import type { Weekday } from './weekdays.ts';

export const weekdayLabels: Record<Weekday, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
};

/** German notation drops the leading zero of the hour: 08:00 becomes 8:00. */
export function formatTime(time: string): string {
  return time.replace(/^0/, '');
}

export function formatRange(range: TimeRange): string {
  return `${formatTime(range.from)}–${formatTime(range.to)} Uhr`;
}
