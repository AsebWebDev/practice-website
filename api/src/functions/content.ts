import { app } from '@azure/functions';
import { getContent, saveContent } from '../handlers/content.ts';
import { getStore } from '../lib/store.ts';

// Public: the site reads the current opening hours and notices from here.
app.http('content-read', {
  route: 'content',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: (_request, context) => getContent(getStore(), context),
});

// The editing page saves here. The handler checks the editor role.
app.http('content-save', {
  route: 'content',
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler: (request, context) => saveContent(request, getStore(), context),
});
