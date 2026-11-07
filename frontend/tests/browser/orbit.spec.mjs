import { test, expect } from '@playwright/test';
test('3D orbit rotates with wheel and page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1487, height: 620 });
  await page.goto('/?demo');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  const canvas = page.locator('.orbit canvas');
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const orbit = await page.locator('.orbit').boundingBox();
  expect(orbit.height).toBeLessThanOrEqual(460);
  const before = Number(await canvas.getAttribute('data-angle'));
  await page.mouse.move(orbit.x + orbit.width / 2, orbit.y + orbit.height / 2);
  await page.mouse.wheel(0, 160);
  await expect.poll(async () => Number(await canvas.getAttribute('data-angle'))).toBeGreaterThan(before + 0.15);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.screenshot({ path: 'qa/orbit-scrolled.png' });
  await expect.poll(async () => Number(await canvas.getAttribute('data-angle'))).toBeGreaterThan(before + 0.351);
  const afterWheel = Number(await canvas.getAttribute('data-angle'));
  const pageOffset = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => Number(await canvas.getAttribute('data-angle'))).toBeLessThan(afterWheel - pageOffset * 0.0022 * 0.8);
});
test('reduced motion disables scroll rotation and retains book navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1487, height: 620 });
  await page.goto('/?demo');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  const canvas = page.locator('.orbit canvas');
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const before = await canvas.getAttribute('data-angle');
  const orbit = await page.locator('.orbit').boundingBox();
  await page.mouse.move(orbit.x + orbit.width / 2, orbit.y + orbit.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await canvas.getAttribute('data-angle')).toBe(before);
  await page.getByRole('button', { name: 'Next book', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pachinko', exact: true })).toBeVisible();
  await expect(page.getByText('USE ARROW KEYS TO EXPLORE')).toBeVisible();
});

test('clicking a visible 3D cover selects that book', async ({ page }) => {
  await page.goto('/?demo');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  const canvas = page.locator('.orbit canvas');
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const bounds = await canvas.boundingBox();
  // Visible orange Klara cover immediately to the left of the front-center book.
  await canvas.click({ position: { x: bounds.width * 0.43, y: bounds.height * 0.73 } });
  await expect(page.getByRole('heading', { name: 'Klara and the Sun', exact: true })).toBeVisible();
});

test('books without catalogued artwork get typeset covers', async ({ page }) => {
  const json = body => route => route.fulfill({ json: body });
  await page.route('**/books', json([{ id: 1, title: 'Atomic Habits', author: 'James Clear', availableCopies: 10 }, { id: 2, title: 'The Creative Act', author: 'Rick Rubin', availableCopies: 2 }, { id: 3, title: 'Postman Test Book', author: 'A. Tester', availableCopies: 1 }]));
  await page.route('**/students', json([]));
  await page.route('**/borrowings', json([]));
  await page.goto('/');
  const canvas = page.locator('.orbit canvas');
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  await expect(canvas).toHaveAttribute('data-title-covers', '2');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'qa/title-covers.png' });
});
