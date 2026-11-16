import { z } from 'astro/zod';

const text = z.string().trim().min(1);

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time like 08:30');

const timeRange = z
  .object({ from: time, to: time })
  .refine((range) => range.from < range.to, {
    message: '"from" must be earlier than "to"',
  });

// An empty list means the practice is closed that day. Two ranges describe
// a day with a lunch break.
const dayHours = z.array(timeRange).refine(
  (ranges) =>
    ranges.every((range, index) => {
      const previous = ranges[index - 1];
      return !previous || previous.to <= range.from;
    }),
  { message: 'time ranges must be in order and must not overlap' },
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

export const noticeSchema = z
  .object({
    kind: z.enum(['info', 'closed']),
    text,
    // Without "from" the notice shows as soon as it is published.
    from: z.iso.date().optional(),
    // The last day on which the notice is shown.
    until: z.iso.date(),
  })
  .refine((notice) => !notice.from || notice.from <= notice.until, {
    message: '"from" must not be later than "until"',
  });

export const noticesSchema = z.array(noticeSchema);

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
