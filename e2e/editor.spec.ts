import { expect, test, type Page } from '@playwright/test';
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  fakeApi,
  fixClock,
  signIn,
} from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  await fixClock(page);
});

const day = (page: Page, name: string) =>
  page.getByRole('group', { name, exact: true });

async function openAsEditor(page: Page) {
  await signIn(page, ['editor']);
  const saved = await fakeApi(page);
  await page.goto('/pflege/');
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
  return saved;
}

test('asks visitors who are not signed in to sign in', async ({ page }) => {
  await signIn(page, null);
  await page.goto('/pflege/');

  await expect(page.getByRole('link', { name: 'Anmelden' })).toBeVisible();
  await expect(page.locator('form')).toBeHidden();
});

test('tells signed-in users without the role that they have no access', async ({
  page,
}) => {
  await signIn(page, []);
  await page.goto('/pflege/');

  await expect(
    page.getByText('nicht für die Pflege freigeschaltet'),
  ).toBeVisible();
  await expect(page.locator('form')).toBeHidden();
});

test('loads the current content into the form', async ({ page }) => {
  await openAsEditor(page);

  const monday = day(page, 'Montag');
  await expect(monday.getByLabel('Montag, Zeitraum 1, von')).toHaveValue(
    '08:00',
  );
  await expect(monday.getByLabel('Montag, Zeitraum 2, bis')).toHaveValue(
    '18:00',
  );
  await expect(day(page, 'Samstag')).toContainText('geschlossen');
  await expect(page.getByLabel('Text (höchstens 300 Zeichen)')).toHaveValue(
    /23\. Dezember/,
  );
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});

test('lists every problem, next to the field and at the top', async ({
  page,
}) => {
  const saved = await openAsEditor(page);

  await day(page, 'Montag').getByLabel('Montag, Zeitraum 2, von').fill('11:00');
  await page.getByRole('button', { name: 'Hinweis hinzufügen' }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();

  const summary = page.locator('[data-error-summary]');
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link')).toHaveText([
    /^Montag: Die Zeiträume müssen nacheinander liegen/,
    'Hinweis 2, Text: Bitte einen Text eingeben.',
    'Hinweis 2, Letzter Tag: Bitte ein Datum wählen.',
  ]);
  await expect(
    page.getByRole('textbox', { name: 'Text (höchstens 300 Zeichen)' }).last(),
  ).toHaveAttribute('aria-invalid', 'true');
  expect(saved).toHaveLength(0);
  await expectNoAxeViolations(page);

  // A link in the summary moves focus to the field.
  await summary.getByRole('link', { name: /Letzter Tag/ }).click();
  await expect(page.getByLabel('Letzter Tag').last()).toBeFocused();
});

test('saves the changes with the version it started from', async ({ page }) => {
  const saved = await openAsEditor(page);

  const saturday = day(page, 'Samstag');
  await saturday.getByRole('button', { name: 'Zeitraum hinzufügen' }).click();
  await expect(saturday.getByLabel('Samstag, von')).toBeFocused();
  await saturday.getByLabel('Samstag, von').fill('09:00');
  await saturday.getByLabel('Samstag, bis').fill('12:00');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect(page.getByRole('status')).toHaveText(
    /^Gespeichert um \d{1,2}:\d{2} Uhr\./,
  );
  expect(saved).toHaveLength(1);
  expect(saved[0]?.body).toMatchObject({
    openingHours: { days: { saturday: [{ from: '09:00', to: '12:00' }] } },
    version: {},
  });

  // The next save sends the version the first one returned.
  await page
    .getByLabel('Satz unter der Tabelle (freiwillig, höchstens 200 Zeichen)')
    .fill('Neu');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1]?.body).toMatchObject({
    version: { openingHours: 'v2', notices: 'v2' },
  });
});

test('explains a conflict with someone who saved in between', async ({
  page,
}) => {
  await signIn(page, ['editor']);
  await fakeApi(page, undefined, () => ({
    status: 409,
    json: { error: 'Someone else saved in the meantime.' },
  }));
  await page.goto('/pflege/');

  await page
    .getByLabel('Satz unter der Tabelle (freiwillig, höchstens 200 Zeichen)')
    .fill('x');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect(page.getByRole('status')).toHaveText(
    /^Jemand anderes hat in der Zwischenzeit gespeichert\./,
  );
});

test('moves focus back to the add button after removing a range', async ({
  page,
}) => {
  await openAsEditor(page);

  const friday = day(page, 'Freitag');
  await friday.getByRole('button', { name: 'Freitag entfernen' }).click();

  await expect(friday).toContainText('geschlossen');
  await expect(
    friday.getByRole('button', { name: 'Zeitraum hinzufügen' }),
  ).toBeFocused();
});
