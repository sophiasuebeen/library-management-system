import { test, expect } from '@playwright/test';
test('home shows a centered search above the orbit and opens the collection', async ({ page }) => {
  await page.goto('/?demo');
  const canvas = page.locator('.orbit canvas');
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('ASIA/SEOUL')).toHaveCount(0);
  await expect(page.getByText(/within reach|big ideas/i)).toHaveCount(0);
  const search = await page.getByRole('searchbox', { name: 'Search collection' }).boundingBox();
  const orbit = await page.locator('.orbit').boundingBox();
  expect(search.y + search.height).toBeLessThanOrEqual(orbit.y);
  const form = await page.getByRole('search').boundingBox();
  expect(Math.abs(form.x + form.width / 2 - page.viewportSize().width / 2)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  // Arrows browse in place; only an explicit book click or a search submit leaves home.
  await page.getByRole('button', { name: 'Next book', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Previous book', exact: true }).click();
  await page.screenshot({ path: 'qa/home.png' });
  const bounds = await canvas.boundingBox();
  await canvas.click({ position: { x: bounds.width * 0.43, y: bounds.height * 0.73 } });
  await expect(page.getByRole('button', { name: 'Collection', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Selected book').getByRole('heading')).toBeVisible();
  await page.getByRole('button', { name: 'Orbit Library', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search collection' }).fill('Pachinko');
  await page.getByRole('searchbox', { name: 'Search collection' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Pachinko', exact: true })).toBeVisible();
});
test('collection, search, borrow, return, students, and waitlists', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?demo');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The Creative Act', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.orbit canvas')).toHaveAttribute('data-textures', 'ready');
  await expect(page.locator('.orbit canvas')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: 'qa/desktop.png' });
  await page.getByRole('button', { name: 'Next book', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pachinko', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous book', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The Creative Act', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search collection' }).fill('no such story');
  await expect(page.getByRole('heading', { name: 'No books found.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('button', { name: 'Check out', exact: true }).click();
  await page.getByRole('combobox', { name: 'Student', exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Confirm check-out', exact: true }).click();
  await expect(page.getByLabel('Selected book')).toContainText('2 copies');
  await page.getByRole('button', { name: 'Borrowings', exact: true }).click();
  const loan = page.getByRole('row').filter({ hasText: 'The Creative Act' });
  await expect(loan).toContainText('Alex Morgan');
  await loan.getByRole('button', { name: 'Return book' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(loan).toHaveCount(0);
  await page.getByRole('button', { name: 'Students', exact: true }).click();
  await page.getByRole('button', { name: 'Register student' }).click();
  await page.getByLabel('Student name').fill('Taylor Reader');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('cell', { name: 'Taylor Reader', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Waitlists', exact: true }).click();
  await page.getByRole('button', { name: 'Ways of Seeing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alex Morgan', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Join waitlist', exact: true }).click();
  await page.getByRole('combobox', { name: 'Student', exact: true }).selectOption('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Join waitlist' }).click();
  await page.getByRole('button', { name: 'Remove next', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Jamie Park', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('mobile layout and keyboard carousel work without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?demo');
  await expect(page.locator('.orbit')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The Creative Act', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.orbit').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'Pachinko', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.screenshot({ path: 'qa/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Check out', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

test('demo covers can be uploaded, replaced and removed', async ({ page }) => {
  await page.goto('/?demo');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await page.getByRole('button', { name: 'View index' }).click();
  const firstCover = page.locator('.index-book img').first();
  await expect(firstCover).toHaveAttribute('src', '/covers/creative-act.png');
  await expect(page.getByRole('button', { name: 'Remove cover' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Upload cover' }).click();
  await page.getByLabel('Cover image').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('dialog').getByRole('button', { name: 'Upload cover' }).click();
  await expect(page.getByText('Cover uploaded.')).toBeVisible();
  await expect(firstCover).toHaveAttribute('src', /^blob:/);

  await page.getByRole('button', { name: 'Remove cover' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove cover' }).click();
  await expect(page.getByText('Cover removed.')).toBeVisible();
  await expect(firstCover).toHaveAttribute('src', '/covers/creative-act.png');
});

test('live cover uploads send the admin password and report rejection', async ({ page }) => {
  const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const uploads = [];
  let covers = [];
  await page.route(/\/(students|borrowings)$/, route => route.fulfill(json([])));
  await page.route(/\/books$/, route => route.fulfill(json([{ id: 7, title: 'Zero to One', author: 'Peter Thiel', availableCopies: 1 }])));
  await page.route(/\/books\/covers$/, route => route.fulfill(json(covers)));
  await page.route(/\/books\/7\/cover(\?.*)?$/, route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    uploads.push({ password: request.headers()['x-admin-password'], type: request.headers()['content-type'], size: request.postDataBuffer()?.length });
    if (request.headers()['x-admin-password'] !== 'right-password') return route.fulfill({ status: 401 });
    covers = [{ bookId: 7, version: 42 }];
    return route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await page.getByRole('button', { name: 'Upload cover' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Cover image').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
  await dialog.getByLabel('Admin password').fill('wrong-password');
  await dialog.getByRole('button', { name: 'Upload cover' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Wrong admin password.');

  await dialog.getByLabel('Admin password').fill('right-password');
  await dialog.getByRole('button', { name: 'Upload cover' }).click();
  await expect(page.getByText('Cover uploaded.')).toBeVisible();
  expect(uploads.map(upload => upload.password)).toEqual(['wrong-password', 'right-password']);
  expect(uploads[1].type).toBe('image/jpeg');
  expect(uploads[1].size).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'View index' }).click();
  await expect(page.locator('.index-book img')).toHaveAttribute('src', '/books/7/cover?v=42');

  // The password is remembered until the page reloads, so several covers need one entry.
  await page.getByRole('button', { name: 'Replace cover' }).click();
  await expect(page.getByLabel('Cover image')).toBeVisible();
  await expect(page.getByLabel('Admin password')).toHaveCount(0);
});

test('the library still loads when covers cannot be read', async ({ page }) => {
  const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(/\/(students|borrowings)$/, route => route.fulfill(json([])));
  await page.route(/\/books$/, route => route.fulfill(json([{ id: 7, title: 'Zero to One', author: 'Peter Thiel', availableCopies: 1 }])));
  await page.route(/\/books\/covers$/, route => route.fulfill({ status: 500 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Zero to One' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload cover' })).toBeVisible();
});
