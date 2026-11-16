import { describe, expect, test } from 'vitest';
import { notices, openingHours, practice, services } from '../src/content';
import {
  noticeSchema,
  openingHoursSchema,
  parseContent,
  practiceSchema,
  servicesSchema,
  weekdays,
} from '../src/content/schema.ts';

const closedAllWeek = Object.fromEntries(weekdays.map((day) => [day, []]));

const hoursOn = (monday: unknown) => ({
  days: { ...closedAllWeek, monday },
});

describe('the content files in the repository', () => {
  test('are valid', () => {
    expect(practice.name).toBe('Zahnarztpraxis Maria Schuch');
    expect(Object.keys(openingHours.days)).toEqual([...weekdays]);
    expect(services.length).toBeGreaterThan(0);
    expect(Array.isArray(notices)).toBe(true);
  });
});

describe('opening hours', () => {
  test('accept a closed day and a day with a lunch break', () => {
    const hours = hoursOn([
      { from: '08:00', to: '12:00' },
      { from: '14:00', to: '18:00' },
    ]);

    expect(openingHoursSchema.safeParse(hours).success).toBe(true);
  });

  test.each([
    ['an hour that does not exist', [{ from: '25:00', to: '26:00' }]],
    ['a time without leading zero', [{ from: '8:00', to: '12:00' }]],
    ['an end before the start', [{ from: '12:00', to: '08:00' }]],
    [
      'overlapping ranges',
      [
        { from: '08:00', to: '13:00' },
        { from: '12:00', to: '18:00' },
      ],
    ],
  ])('reject %s', (_, monday) => {
    expect(openingHoursSchema.safeParse(hoursOn(monday)).success).toBe(false);
  });

  test('reject a missing weekday', () => {
    const sixDays = Object.fromEntries(
      weekdays.filter((day) => day !== 'sunday').map((day) => [day, []]),
    );

    expect(openingHoursSchema.safeParse({ days: sixDays }).success).toBe(false);
  });
});

describe('notices', () => {
  const notice = { kind: 'closed', text: 'Praxis geschlossen' };

  test('accept a notice with and without a start date', () => {
    expect(
      noticeSchema.safeParse({ ...notice, until: '2027-01-02' }).success,
    ).toBe(true);
    expect(
      noticeSchema.safeParse({
        ...notice,
        from: '2026-12-23',
        until: '2027-01-02',
      }).success,
    ).toBe(true);
  });

  test.each([
    ['a day that does not exist', { until: '2027-02-30' }],
    ['a German date format', { until: '02.01.2027' }],
    ['an end before the start', { from: '2027-01-02', until: '2026-12-23' }],
    ['a missing end date', {}],
    ['an empty text', { text: ' ', until: '2027-01-02' }],
  ])('reject %s', (_, fields) => {
    expect(noticeSchema.safeParse({ ...notice, ...fields }).success).toBe(
      false,
    );
  });
});

describe('services and practice details', () => {
  test('reject an icon the site has no drawing for', () => {
    const service = { icon: 'tooth', title: 'x', description: 'y' };

    expect(servicesSchema.safeParse([service]).success).toBe(false);
  });

  test('reject a phone number that would not work in a tel: link', () => {
    const broken = {
      ...practice,
      phone: { display: '030 23125 482', international: '030 23125 482' },
    };

    expect(practiceSchema.safeParse(broken).success).toBe(false);
  });
});

describe('parseContent', () => {
  test('names the file and the field in its error', () => {
    const broken = hoursOn([{ from: '25:00', to: '26:00' }]);

    expect(() =>
      parseContent(openingHoursSchema, broken, 'opening-hours.json'),
    ).toThrow(/src\/content\/opening-hours\.json[\s\S]*days\.monday/);
  });
});
