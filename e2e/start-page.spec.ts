import { expect, test } from '@playwright/test';
import {
  builtContent,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  fakeApi,
  fixClock,
} from './fixtures.ts';

test.beforeEach(async ({ page }) => {
  await fixClock(page);
});

const hoursCell = (day: string) => `[data-weekday="${day}"] td`;

test('shows the built content when there is no API', async ({ page }) => {
  await page.route('**/api/content', (route) => route.fulfill({ status: 404 }));
  await page.goto('/');

  await expect(page.locator(hoursCell('saturday'))).toHaveText('geschlossen');
  await expect(page.locator('tr[aria-current="date"] th')).toHaveText(
    'Dienstag (heute)',
  );
  // The holiday notice starts on 1 November and runs into January.
  await expect(
    page.getByRole('complementary', { name: 'Aktuelle Hinweise' }),
  ).toContainText('23. Dezember');
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});

test('replaces the built content with what was saved', async ({ page }) => {
  await fakeApi(page, {
    ...builtContent,
    openingHours: {
      days: {
        ...builtContent.openingHours.days,
        saturday: [{ from: '09:00', to: '12:00' }],
      },
    },
    notices: [
      {
        kind: 'info',
        text: 'Neue Telefonnummer ab Januar',
        until: '2027-01-31',
      },
      {
        kind: 'closed',
        text: 'Brückentag geschlossen',
        from: '2027-05-14',
        until: '2027-05-14',
      },
    ],
  });
  await page.goto('/');

  await expect(page.locator(hoursCell('saturday'))).toHaveText(
    '9:00–12:00 Uhr',
  );
  const bar = page.getByRole('complementary', { name: 'Aktuelle Hinweise' });
  await expect(bar.getByText('Neue Telefonnummer ab Januar')).toBeVisible();
  // Starts in May: in the page, but hidden until then.
  await expect(bar.getByText('Brückentag geschlossen')).toBeHidden();
  await expect(bar).not.toContainText('23. Dezember');
  // No sentence under the table was saved, so none is shown.
  await expect(page.locator('[data-hours-note]')).toBeHidden();
});

test('keeps the built content when the API answers with something else', async ({
  page,
}) => {
  await page.route('**/api/content', (route) =>
    route.fulfill({ json: { error: 'Saving failed.' } }),
  );
  await page.goto('/');

  await expect(page.locator(hoursCell('monday'))).toContainText(
    '8:00–12:00 Uhr',
  );
});

test('hides a notice after its last day', async ({ page }) => {
  await fixClock(page, new Date('2027-01-03T09:00:00+01:00'));
  await fakeApi(page);
  await page.goto('/');

  await expect(
    page.getByRole('complementary', { name: 'Aktuelle Hinweise' }),
  ).toBeHidden();
});

for (const [letter, name] of [
  ['A', 'Frisch und klar'],
  ['B', 'Warm und vertraut'],
  ['C', 'Ruhig und modern'],
]) {
  test(`design direction ${letter} is reachable and accessible`, async ({
    page,
  }) => {
    await fakeApi(page);
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Designrichtung wählen' })
      .getByRole('link', { name: `${letter}: ${name}` })
      .click();

    await expect(
      page.getByRole('link', { name: `${letter}: ${name}` }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByText('Entwurf – keine echte Praxisseite.'),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
}
