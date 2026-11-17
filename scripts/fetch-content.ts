// Before a build in CI, replaces the opening hours and notices in
// src/content/ with what the practice saved on the editing page, so the
// HTML already shows the current state instead of correcting it in the
// browser a moment later.
//
// It never fails the build: without CONTENT_URL, when the API does not
// answer, or when a part is invalid, the files from the repository stay.

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validLiveParts } from './live-content.ts';

const url = process.env.CONTENT_URL;
const contentDir = join(import.meta.dirname, '..', 'src', 'content');

// A function that has been idle can take several seconds to start.
const timeoutMs = 20_000;
const attempts = 2;

async function fetchBody(): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url!, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`answered ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

if (!url) {
  console.log('CONTENT_URL is not set; using the content from the repository.');
} else {
  try {
    const parts = validLiveParts(await fetchBody());
    const written: string[] = [];

    if (parts.openingHours) {
      await writeFile(
        join(contentDir, 'opening-hours.json'),
        `${JSON.stringify(parts.openingHours, null, 2)}\n`,
      );
      written.push('opening hours');
    }
    if (parts.notices) {
      await writeFile(
        join(contentDir, 'notices.json'),
        `${JSON.stringify(parts.notices, null, 2)}\n`,
      );
      written.push('notices');
    }

    console.log(
      written.length > 0
        ? `Using the saved ${written.join(' and ')} from ${url}.`
        : `Nothing valid at ${url}; using the content from the repository.`,
    );
  } catch (error) {
    console.warn(
      `Could not load ${url} (${String(error)}); using the content from the repository.`,
    );
  }
}
