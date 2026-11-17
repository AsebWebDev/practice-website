import { berlinToday, isNoticeActive } from '../lib/dates.ts';

/**
 * The HTML was built some time ago and shows what was true then. This
 * brings the two date-dependent parts up to the visitor's present.
 */
export function applyDates(now = new Date()) {
  const today = berlinToday(now);

  for (const row of document.querySelectorAll<HTMLElement>('[data-weekday]')) {
    const isToday = row.dataset.weekday === today.weekday;

    if (isToday) {
      row.setAttribute('aria-current', 'date');
    } else {
      row.removeAttribute('aria-current');
    }

    const label = row.querySelector<HTMLElement>('[data-today-label]');
    if (label) label.hidden = !isToday;
  }

  const noticeBar = document.querySelector<HTMLElement>('[data-notices]');
  if (!noticeBar) return;

  let visible = 0;

  for (const item of noticeBar.querySelectorAll<HTMLElement>(
    '[data-notice-until]',
  )) {
    const active = isNoticeActive(
      {
        from: item.dataset.noticeFrom,
        until: item.dataset.noticeUntil ?? '',
      },
      today.date,
    );

    item.hidden = !active;
    if (active) visible += 1;
  }

  noticeBar.hidden = visible === 0;
}
