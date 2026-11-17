import { app, type HttpResponseInit } from '@azure/functions';
import { notices, openingHours } from '../../../src/content/index.ts';

/** Public: the site reads the current opening hours and notices from here. */
export async function getContent(): Promise<HttpResponseInit> {
  return {
    jsonBody: { openingHours, notices },
    // Visitors must see a change right after it is saved.
    headers: { 'cache-control': 'no-store' },
  };
}

app.http('content', {
  route: 'content',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: getContent,
});
