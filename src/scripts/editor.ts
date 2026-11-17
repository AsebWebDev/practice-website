// Must stay the first import, see the module.
import '../lib/zod-without-eval.ts';
import { editableContentSchema } from '../content/schema.ts';
import { berlinToday, isNoticeExpired } from '../lib/dates.ts';
import {
  issuePath,
  toPayload,
  type Issue,
  type RawForm,
  type RawNotice,
  type RawRange,
} from '../lib/editor-data.ts';
import { weekdays, type Weekday } from '../lib/weekdays.ts';

// Platform routes of Azure Static Web Apps. They sit at the root of the
// host, whatever folder the site itself is served from.
const meUrl = '/.auth/me';
const contentUrl = '/api/content';
const editorRole = 'editor';
const maxRanges = 3;

type View = 'loading' | 'signed-out' | 'forbidden' | 'unavailable' | 'ready';

const $ = <T extends Element>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector)!;
const $$ = <T extends Element>(
  selector: string,
  root: ParentNode = document,
) => [...root.querySelectorAll<T>(selector)];

const form = $<HTMLFormElement>('form[data-view="ready"]');
const status = $<HTMLElement>('[data-status]');
const summary = $<HTMLElement>('[data-error-summary]');
const noticeList = $<HTMLUListElement>('[data-notices]');
const saveButton = $<HTMLButtonElement>('button[type="submit"]', form);
const rangeTemplate = $<HTMLTemplateElement>('#range-template');
const noticeTemplate = $<HTMLTemplateElement>('#notice-template');

let dirty = false;
// The state the form started from, sent back when saving so the API can
// refuse the save if someone else saved in between.
let version: Record<string, string> = {};
let nextId = 0;

function show(view: View) {
  for (const element of $$<HTMLElement>('[data-view]')) {
    element.hidden = element.dataset.view !== view;
  }
}

function dayFieldset(day: Weekday) {
  return $<HTMLFieldSetElement>(`fieldset[data-day="${day}"]`);
}

// Labels, error ids and paths depend on the position, so they are set
// again after every addition or removal.
function refreshDay(day: Weekday) {
  const fieldset = dayFieldset(day);
  const label = fieldset.dataset.label ?? day;
  const rows = $$<HTMLLIElement>('[data-range]', fieldset);

  rows.forEach((row, index) => {
    const position = rows.length > 1 ? `, Zeitraum ${index + 1}` : '';
    for (const input of $$<HTMLInputElement>('input', row)) {
      const field = input.dataset.field as 'from' | 'to';
      input.dataset.path = `openingHours.days.${day}.${index}.${field}`;
      input.setAttribute(
        'aria-label',
        `${label}${position}, ${field === 'from' ? 'von' : 'bis'}`,
      );
    }
    $<HTMLButtonElement>('[data-remove]', row).setAttribute(
      'aria-label',
      `${label}${position} entfernen`,
    );
  });

  $<HTMLElement>('[data-closed]', fieldset).hidden = rows.length > 0;
  $<HTMLButtonElement>('[data-add-range]', fieldset).hidden =
    rows.length >= maxRanges;
}

function addRange(day: Weekday, range: RawRange = { from: '', to: '' }) {
  const row = rangeTemplate.content.firstElementChild!.cloneNode(
    true,
  ) as HTMLLIElement;
  $<HTMLInputElement>('[data-field="from"]', row).value = range.from;
  $<HTMLInputElement>('[data-field="to"]', row).value = range.to;
  $<HTMLButtonElement>('[data-remove]', row).addEventListener('click', () => {
    row.remove();
    refreshDay(day);
    markDirty();
    $<HTMLButtonElement>('[data-add-range]', dayFieldset(day)).focus();
  });
  $<HTMLUListElement>('[data-ranges]', dayFieldset(day)).append(row);
  refreshDay(day);
  return row;
}

function refreshNotices() {
  const today = berlinToday(new Date()).date;
  const items = $$<HTMLLIElement>('[data-notice]', noticeList);

  items.forEach((item, index) => {
    item.dataset.label = `Hinweis ${index + 1}`;
    $<HTMLElement>('[data-number]', item).textContent = String(index + 1);
    for (const element of $$<HTMLElement>('[data-field]', item)) {
      element.dataset.path = `notices.${index}.${element.dataset.field}`;
    }
    $<HTMLButtonElement>('[data-remove]', item).setAttribute(
      'aria-label',
      `Hinweis ${index + 1} löschen`,
    );
    const until = $<HTMLInputElement>('[data-field="until"]', item).value;
    $<HTMLElement>('[data-expired]', item).hidden =
      !until || !isNoticeExpired({ until }, today);
  });

  $<HTMLElement>('[data-no-notices]').hidden = items.length > 0;
}

function addNotice(
  notice: RawNotice = { kind: 'closed', text: '', from: '', until: '' },
) {
  const item = noticeTemplate.content.firstElementChild!.cloneNode(
    true,
  ) as HTMLLIElement;
  for (const element of $$<HTMLInputElement>('[data-field]', item)) {
    element.value = notice[element.dataset.field as keyof RawNotice];
  }
  $<HTMLButtonElement>('[data-remove]', item).addEventListener('click', () => {
    item.remove();
    refreshNotices();
    markDirty();
    $<HTMLButtonElement>('[data-add-notice]').focus();
  });
  noticeList.append(item);
  refreshNotices();
  return item;
}

function readForm(): RawForm {
  const days = Object.fromEntries(
    weekdays.map((day) => [
      day,
      $$<HTMLLIElement>('[data-range]', dayFieldset(day)).map((row) => ({
        from: $<HTMLInputElement>('[data-field="from"]', row).value,
        to: $<HTMLInputElement>('[data-field="to"]', row).value,
      })),
    ]),
  ) as Record<Weekday, RawRange[]>;

  const notices = $$<HTMLLIElement>('[data-notice]', noticeList).map((item) => {
    const value = (field: keyof RawNotice) =>
      $<HTMLInputElement>(`[data-field="${field}"]`, item).value;
    return {
      kind: value('kind'),
      text: value('text'),
      from: value('from'),
      until: value('until'),
    };
  });

  return { days, note: $<HTMLTextAreaElement>('#note').value, notices };
}

function clearErrors() {
  summary.hidden = true;
  $<HTMLUListElement>('ul', summary).replaceChildren();
  for (const element of $$<HTMLElement>('[aria-invalid]', form)) {
    element.removeAttribute('aria-invalid');
    element.removeAttribute('aria-describedby');
  }
  for (const message of $$<HTMLElement>('[data-error]', form)) {
    message.hidden = true;
    message.textContent = '';
  }
}

/** A short name for the error summary, such as "Hinweis 2, Letzter Tag". */
function fieldName(target: HTMLElement): string {
  const ariaLabel = target.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const notice = target.closest<HTMLElement>('[data-notice]')?.dataset.label;
  // The first text inside the label is the visible field name; hints in
  // brackets are left out.
  const label = target
    .closest('label')
    ?.firstChild?.textContent?.replace(/\(.*\)/, '')
    .trim();

  return [notice ?? target.dataset.label, label].filter(Boolean).join(', ');
}

/**
 * Puts each message next to its field and lists all of them at the top, so
 * screen reader users hear them and everyone can jump to the field.
 */
function showErrors(issues: Issue[]) {
  clearErrors();
  const list = $<HTMLUListElement>('ul', summary);

  for (const issue of issues) {
    // Paths can come from the server, so they are escaped before they go
    // into a selector.
    const byPath = (path: string) =>
      form.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    let path = issuePath(issue);
    let target = byPath(path);

    // A message about a whole range belongs to its day.
    while (!target && path.includes('.')) {
      path = path.slice(0, path.lastIndexOf('.'));
      target = byPath(path);
    }
    if (!target) continue;

    const isField = target.matches('input, select, textarea');
    const message = isField
      ? $<HTMLElement>('[data-error]', target.closest('[data-wrapper]')!)
      : $<HTMLElement>(':scope > [data-error]', target);

    message.id ||= `error-${nextId++}`;
    message.textContent = issue.message;
    message.hidden = false;

    const focusTarget = isField
      ? target
      : (target.querySelector<HTMLElement>('input, button') ?? target);
    if (isField) {
      target.setAttribute('aria-invalid', 'true');
      target.setAttribute('aria-describedby', message.id);
    }
    focusTarget.id ||= `field-${nextId++}`;

    const link = document.createElement('a');
    link.href = `#${focusTarget.id}`;
    link.className = 'underline';
    link.textContent = `${fieldName(target)}: ${issue.message}`;
    const item = document.createElement('li');
    item.append(link);
    list.append(item);
  }

  summary.hidden = list.childElementCount === 0;
  if (!summary.hidden) summary.focus();
}

function markDirty() {
  dirty = true;
  status.textContent = '';
}

async function save(event: SubmitEvent) {
  event.preventDefault();
  status.textContent = '';

  const payload = toPayload(readForm());
  const checked = editableContentSchema.safeParse(payload);

  if (!checked.success) {
    showErrors(checked.error.issues);
    return;
  }
  clearErrors();

  saveButton.disabled = true;
  saveButton.textContent = 'Wird gespeichert …';

  try {
    const response = await fetch(contentUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...checked.data, version }),
    });

    if (response.ok) {
      dirty = false;
      version = ((await response.json()) as { version: typeof version })
        .version;
      const time = new Intl.DateTimeFormat('de-DE', {
        timeStyle: 'short',
        timeZone: 'Europe/Berlin',
      }).format(new Date());
      status.textContent = `Gespeichert um ${time} Uhr. Die Änderung ist jetzt auf der Webseite zu sehen.`;
    } else if (response.status === 400) {
      const body = (await response.json()) as { issues?: Issue[] };
      showErrors(body.issues ?? []);
    } else if (response.status === 409) {
      status.textContent =
        'Jemand anderes hat in der Zwischenzeit gespeichert. Damit nichts verloren geht, wurde Ihre Änderung nicht übernommen. Bitte merken Sie sich Ihre Änderung, laden Sie die Seite neu und tragen Sie sie noch einmal ein.';
    } else if (response.status === 401 || response.status === 403) {
      status.textContent =
        'Ihre Anmeldung ist abgelaufen. Bitte laden Sie die Seite neu und melden Sie sich an. Ihre Eingaben gehen dabei verloren.';
    } else {
      status.textContent =
        'Speichern hat nicht geklappt. Bitte versuchen Sie es gleich noch einmal.';
    }
  } catch {
    // An expired sign-in also ends up here: Azure answers with a redirect
    // to the Microsoft login, which a background request cannot follow.
    status.textContent = (await isSignedIn())
      ? 'Keine Verbindung. Bitte prüfen Sie Ihr Internet und versuchen Sie es noch einmal.'
      : 'Ihre Anmeldung ist abgelaufen. Bitte laden Sie die Seite neu und melden Sie sich an. Ihre Eingaben gehen dabei verloren.';
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Speichern';
  }
}

type Principal = { userDetails: string; userRoles: string[] };

async function isSignedIn(): Promise<boolean> {
  try {
    const me = await fetch(meUrl);
    const body = (await me.json()) as { clientPrincipal: Principal | null };
    return body.clientPrincipal !== null;
  } catch {
    // Unknown; the caller then assumes a network problem.
    return true;
  }
}

type Content = {
  openingHours: {
    days: Record<Weekday, RawRange[]>;
    note?: string;
  };
  notices: (Omit<RawNotice, 'from'> & { from?: string })[];
  version?: Record<string, string>;
};

async function start() {
  let principal: Principal | null;
  let content: Content;

  try {
    const me = await fetch(meUrl);
    if (!me.ok) throw new Error(`${meUrl} answered ${me.status}`);
    principal = ((await me.json()) as { clientPrincipal: Principal | null })
      .clientPrincipal;
  } catch {
    show('unavailable');
    return;
  }

  if (!principal) {
    show('signed-out');
    return;
  }
  for (const element of $$<HTMLElement>('[data-user]')) {
    element.textContent = principal.userDetails;
  }
  if (!principal.userRoles.includes(editorRole)) {
    show('forbidden');
    return;
  }

  try {
    const response = await fetch(contentUrl);
    if (!response.ok)
      throw new Error(`${contentUrl} answered ${response.status}`);
    content = (await response.json()) as Content;
    version = content.version ?? {};
  } catch {
    show('unavailable');
    return;
  }

  for (const day of weekdays) {
    for (const range of content.openingHours.days[day]) addRange(day, range);
    refreshDay(day);
    $<HTMLButtonElement>('[data-add-range]', dayFieldset(day)).addEventListener(
      'click',
      () => {
        const row = addRange(day);
        markDirty();
        $<HTMLInputElement>('input', row).focus();
      },
    );
  }
  $<HTMLTextAreaElement>('#note').value = content.openingHours.note ?? '';

  for (const notice of content.notices) {
    addNotice({ ...notice, from: notice.from ?? '' });
  }
  refreshNotices();
  $<HTMLButtonElement>('[data-add-notice]').addEventListener('click', () => {
    const item = addNotice();
    markDirty();
    $<HTMLSelectElement>('select', item).focus();
  });

  form.addEventListener('input', (event) => {
    markDirty();
    if ((event.target as HTMLElement).dataset.field === 'until') {
      refreshNotices();
    }
  });
  form.addEventListener('submit', (event) => void save(event));
  window.addEventListener('beforeunload', (event) => {
    if (dirty) event.preventDefault();
  });

  show('ready');
}

void start();
