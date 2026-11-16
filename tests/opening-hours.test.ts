import { expect, test } from 'vitest';
import { formatRange, formatTime } from '../src/lib/opening-hours.ts';

test('drops the leading zero of the hour, as German notation does', () => {
  expect(formatTime('08:00')).toBe('8:00');
  expect(formatTime('14:30')).toBe('14:30');
  expect(formatTime('00:15')).toBe('0:15');
});

test('formats a range with an en dash and "Uhr"', () => {
  expect(formatRange({ from: '08:00', to: '12:30' })).toBe('8:00–12:30 Uhr');
});
