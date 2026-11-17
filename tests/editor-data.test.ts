import { describe, expect, test } from 'vitest';
import { editableContentSchema } from '../src/content/schema.ts';
import { issuePath, toPayload, type RawForm } from '../src/lib/editor-data.ts';
import { weekdays } from '../src/lib/weekdays.ts';

const closed = Object.fromEntries(weekdays.map((day) => [day, []]));

const form = (overrides: Partial<RawForm> = {}): RawForm => ({
  days: {
    ...closed,
    monday: [{ from: '08:00', to: '12:00' }],
  } as RawForm['days'],
  note: '',
  notices: [],
  ...overrides,
});

describe('toPayload', () => {
  test('leaves out an empty note and an empty start date', () => {
    const payload = toPayload(
      form({
        note: '   ',
        notices: [
          {
            kind: 'info',
            text: ' Neue Nummer ',
            from: '',
            until: '2027-02-01',
          },
        ],
      }),
    );

    expect(payload.openingHours).not.toHaveProperty('note');
    expect(payload.notices).toEqual([
      { kind: 'info', text: 'Neue Nummer', until: '2027-02-01' },
    ]);
    expect(editableContentSchema.safeParse(payload).success).toBe(true);
  });

  test('keeps a note and a start date that are filled in', () => {
    const payload = toPayload(
      form({
        note: 'Termine nach Vereinbarung.',
        notices: [
          {
            kind: 'closed',
            text: 'Urlaub',
            from: '2026-12-23',
            until: '2027-01-02',
          },
        ],
      }),
    );

    expect(payload.openingHours.note).toBe('Termine nach Vereinbarung.');
    expect(payload.notices[0]).toHaveProperty('from', '2026-12-23');
  });

  test('an empty time and an empty last day fail with German messages', () => {
    const payload = toPayload(
      form({
        days: {
          ...closed,
          monday: [{ from: '', to: '12:00' }],
        } as RawForm['days'],
        notices: [{ kind: 'closed', text: 'Urlaub', from: '', until: '' }],
      }),
    );
    const result = editableContentSchema.safeParse(payload);

    expect(result.success).toBe(false);
    const messages = Object.fromEntries(
      result.error!.issues.map((issue) => [issuePath(issue), issue.message]),
    );
    expect(messages).toEqual({
      'openingHours.days.monday.0.from':
        'Bitte eine Uhrzeit wie 08:30 eingeben.',
      'notices.0.until': 'Bitte ein Datum wählen.',
    });
  });
});
