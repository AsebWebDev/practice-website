import { isLiveContent, type LiveContent } from '../lib/live-content.ts';
import { formatRange } from '../lib/opening-hours.ts';
import { weekdays } from '../lib/weekdays.ts';
import { applyDates } from './apply-dates.ts';

// A platform route of Azure Static Web Apps, always at the root of the host.
const contentUrl = '/api/content';

// After this long the page keeps showing what it was built with. A function
// that has been idle can take a few seconds to start.
const timeoutMs = 8000;

async function fetchContent(): Promise<LiveContent | undefined> {
  try {
    const response = await fetch(contentUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return undefined;

    const body: unknown = await response.json();
    return isLiveContent(body) ? body : undefined;
  } catch {
    // Offline, timed out, or a host without the API such as the preview.
    return undefined;
  }
}

function renderHours({ openingHours }: LiveContent) {
  for (const day of weekdays) {
    const cell = document.querySelector(`[data-weekday="${day}"] td`);
    if (!cell) continue;

    const ranges = openingHours.days[day];
    cell.replaceChildren(
      ...(ranges.length === 0
        ? [span('geschlossen', 'text-muted')]
        : ranges.map((range) =>
            span(formatRange(range), 'block whitespace-nowrap'),
          )),
    );
  }

  const note = document.querySelector<HTMLElement>('[data-hours-note]');
  if (note) {
    note.textContent = openingHours.note ?? '';
    note.hidden = !openingHours.note;
  }
}

function renderNotices({ notices }: LiveContent) {
  const list = document.querySelector('[data-notices] ul');
  if (!list) return;

  list.replaceChildren(
    ...notices.map((notice) => {
      const item = document.createElement('li');
      item.className = 'py-3 font-medium';
      item.textContent = notice.text;
      item.dataset.noticeUntil = notice.until;
      if (notice.from) item.dataset.noticeFrom = notice.from;
      return item;
    }),
  );
}

function span(text: string, className: string) {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

applyDates();

const content = await fetchContent();
if (content) {
  renderHours(content);
  renderNotices(content);
  applyDates();
}
