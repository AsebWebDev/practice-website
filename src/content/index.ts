import noticesData from './notices.json';
import openingHoursData from './opening-hours.json';
import practiceData from './practice.json';
import {
  noticesSchema,
  openingHoursSchema,
  parseContent,
  practiceSchema,
  servicesSchema,
} from './schema.ts';
import servicesData from './services.json';

export const practice = parseContent(
  practiceSchema,
  practiceData,
  'practice.json',
);

export const openingHours = parseContent(
  openingHoursSchema,
  openingHoursData,
  'opening-hours.json',
);

export const notices = parseContent(noticesSchema, noticesData, 'notices.json');

export const services = parseContent(
  servicesSchema,
  servicesData,
  'services.json',
);
