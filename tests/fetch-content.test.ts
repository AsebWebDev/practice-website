import { describe, expect, test } from 'vitest';
import { validLiveParts } from '../scripts/live-content.ts';
import { notices, openingHours } from '../src/content';

const saturday = {
  ...openingHours,
  days: { ...openingHours.days, saturday: [{ from: '09:00', to: '12:00' }] },
};

describe('validLiveParts', () => {
  test('takes both parts of a valid answer and drops the version', () => {
    const parts = validLiveParts({
      openingHours: saturday,
      notices,
      version: { openingHours: 'v1' },
    });

    expect(parts).toEqual({ openingHours: saturday, notices });
  });

  test('keeps a valid part when the other one is broken', () => {
    expect(
      validLiveParts({ openingHours: { days: 'broken' }, notices }),
    ).toEqual({ notices });
  });

  test.each([
    ['nothing', null],
    ['an error answer', { error: 'Saving failed.' }],
    ['text', 'Service Unavailable'],
  ])('takes nothing from %s', (_, body) => {
    expect(validLiveParts(body)).toEqual({});
  });
});
