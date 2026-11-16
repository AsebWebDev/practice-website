import { describe, expect, test } from 'vitest';
import {
  berlinToday,
  isNoticeActive,
  isNoticeExpired,
} from '../src/lib/dates.ts';

const at = (iso: string) => berlinToday(new Date(iso));

describe('berlinToday', () => {
  test('uses the date in Germany, not the UTC date, in winter', () => {
    // 23:30 UTC is 00:30 the next day in Berlin (UTC+1).
    expect(at('2026-12-22T23:30:00Z')).toEqual({
      date: '2026-12-23',
      weekday: 'wednesday',
    });
    expect(at('2026-12-22T22:30:00Z').date).toBe('2026-12-22');
  });

  test('uses the date in Germany in summer time', () => {
    // 22:30 UTC is 00:30 the next day in Berlin (UTC+2).
    expect(at('2026-06-30T22:30:00Z')).toEqual({
      date: '2026-07-01',
      weekday: 'wednesday',
    });
    expect(at('2026-06-30T21:30:00Z').date).toBe('2026-06-30');
  });

  test('stays on the same day across the switch to summer time', () => {
    // Clocks jump from 02:00 to 03:00 on 29 March 2026.
    expect(at('2026-03-29T00:30:00Z')).toEqual({
      date: '2026-03-29',
      weekday: 'sunday',
    });
    expect(at('2026-03-29T01:30:00Z')).toEqual({
      date: '2026-03-29',
      weekday: 'sunday',
    });
  });

  test('rolls over into the new year at midnight in Germany', () => {
    expect(at('2026-12-31T22:59:59Z').date).toBe('2026-12-31');
    expect(at('2026-12-31T23:00:00Z')).toEqual({
      date: '2027-01-01',
      weekday: 'friday',
    });
  });
});

describe('isNoticeActive', () => {
  const holidays = { from: '2026-12-23', until: '2027-01-02' };

  test('is false before the start date', () => {
    expect(isNoticeActive(holidays, '2026-12-22')).toBe(false);
  });

  test('is true on the first day, across the new year and on the last day', () => {
    expect(isNoticeActive(holidays, '2026-12-23')).toBe(true);
    expect(isNoticeActive(holidays, '2027-01-01')).toBe(true);
    expect(isNoticeActive(holidays, '2027-01-02')).toBe(true);
  });

  test('is false from the day after the last day', () => {
    expect(isNoticeActive(holidays, '2027-01-03')).toBe(false);
  });

  test('is true right away when there is no start date', () => {
    expect(isNoticeActive({ until: '2027-01-02' }, '2020-01-01')).toBe(true);
  });
});

describe('isNoticeExpired', () => {
  test('is true only after the last day', () => {
    expect(isNoticeExpired({ until: '2027-01-02' }, '2027-01-02')).toBe(false);
    expect(isNoticeExpired({ until: '2027-01-02' }, '2027-01-03')).toBe(true);
  });
});
