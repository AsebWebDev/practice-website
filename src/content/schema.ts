import { z } from 'zod';

// Messages are German because the practice staff see them in the editing
// form. They also appear in build errors.
const text = z.string().trim().min(1, 'Bitte einen Text eingeben.');

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Bitte eine Uhrzeit wie 08:30 eingeben.');

const timeRange = z
  .object({ from: time, to: time })
  .refine((range) => range.from < range.to, {
    message: 'Das Ende muss nach dem Beginn liegen.',
    path: ['to'],
  });

// An empty list means the practice is closed that day. Two ranges describe
// a day with a lunch break.
const dayHours = z
  .array(timeRange)
  .max(3, 'Höchstens drei Zeiträume pro Tag.')
  .refine(
    (ranges) =>
      ranges.every((range, index) => {
        const previous = ranges[index - 1];
        return !previous || previous.to <= range.from;
      }),
    {
      message:
        'Die Zeiträume müssen nacheinander liegen und dürfen sich nicht überschneiden.',
    },
  );

export const openingHoursSchema = z.object({
  days: z.object({
    monday: dayHours,
    tuesday: dayHours,
    wednesday: dayHours,
    thursday: dayHours,
    friday: dayHours,
    saturday: dayHours,
    sunday: dayHours,
  }),
  note: text.optional(),
});

const date = z.iso.date('Bitte ein Datum wählen.');

export const noticeSchema = z
  .object({
    kind: z.enum(['info', 'closed'], 'Bitte eine Art wählen.'),
    text,
    // Without "from" the notice shows as soon as it is published.
    from: date.optional(),
    // The last day on which the notice is shown.
    until: date,
  })
  .refine((notice) => !notice.from || notice.from <= notice.until, {
    message: 'Der erste Tag darf nicht nach dem letzten liegen.',
    path: ['from'],
  });

export const noticesSchema = z.array(noticeSchema);

/** What the editing form saves and the API accepts. */
export const editableContentSchema = z.object({
  openingHours: openingHoursSchema,
  notices: noticesSchema,
});

export const serviceIcons = [
  'checkup',
  'filling',
  'prosthetics',
  'root-canal',
  'children',
  'anxiety',
] as const;

export const servicesSchema = z
  .array(
    z.object({
      icon: z.enum(serviceIcons),
      title: text,
      description: text,
    }),
  )
  .min(1);

export const practiceSchema = z.object({
  name: text,
  greeting: text,
  // One entry per paragraph of the "about" section.
  about: z.array(text).min(1),
  address: z.object({
    street: text,
    postalCode: z.string().regex(/^\d{5}$/, 'must be five digits'),
    city: text,
  }),
  phone: z.object({
    display: text,
    // Used for the tel: link, which needs the number without spaces.
    international: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, 'must look like +4930123456'),
  }),
  email: z.email(),
  directions: z.object({
    publicTransport: text,
    parking: text,
    accessibility: text,
    mapUrl: z.url({ protocol: /^https$/ }),
  }),
});

export type OpeningHours = z.infer<typeof openingHoursSchema>;
export type TimeRange = z.infer<typeof timeRange>;
export type Notice = z.infer<typeof noticeSchema>;
export type Service = z.infer<typeof servicesSchema>[number];
export type Practice = z.infer<typeof practiceSchema>;

/**
 * Checks the content of one file and names that file in the error, so
 * whoever edited it can tell from the failed build where to look.
 */
export function parseContent<Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
  file: string,
): z.infer<Schema> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new Error(
      `Invalid content in src/content/${file}:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
