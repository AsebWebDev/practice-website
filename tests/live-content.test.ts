import { describe, expect, test } from 'vitest';
import { notices, openingHours } from '../src/content';
import { isLiveContent } from '../src/lib/live-content.ts';

const valid = { openingHours, notices };

describe('isLiveContent', () => {
  test('accepts what the API returns', () => {
    expect(isLiveContent(valid)).toBe(true);
    expect(
      isLiveContent({
        ...valid,
        notices: [{ kind: 'info', text: 'Hinweis', until: '2027-01-01' }],
      }),
    ).toBe(true);
  });

  test.each([
    ['nothing', null],
    ['an error page', { error: 'Saving failed.' }],
    [
      'a missing weekday',
      {
        ...valid,
        openingHours: {
          days: { ...openingHours.days, sunday: undefined },
        },
      },
    ],
    [
      'a range without end',
      {
        ...valid,
        openingHours: {
          days: { ...openingHours.days, monday: [{ from: '08:00' }] },
        },
      },
    ],
    ['notices that are not a list', { ...valid, notices: {} }],
    [
      'a notice without text',
      { ...valid, notices: [{ kind: 'info', until: '2027-01-01' }] },
    ],
  ])('rejects %s', (_, value) => {
    expect(isLiveContent(value)).toBe(false);
  });
});
