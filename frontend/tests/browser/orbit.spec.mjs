import { test, expect } from '@playwright/test';
test('compact 3D orbit rotates with wheel and page scroll', async ({ page }) => {
  await page.goto('/?demo');
  const canvas = page.locator('.orbit canvas');
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const orbit = await page.locator('.orbit').boundingBox();
  expect(orbit.width).toBeLessThanOrEqual(1060);
  expect(orbit.height).toBeLessThanOrEqual(340);
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
  await page.goto('/?demo');
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
  const canvas = page.locator('.orbit canvas');
  await expect(canvas).toHaveAttribute('data-textures', 'ready');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  const bounds = await canvas.boundingBox();
  // Visible orange Klara cover immediately to the left of the front-center book.
  await canvas.click({ position: { x: bounds.width * 0.43, y: bounds.height * 0.73 } });
  await expect(page.getByRole('heading', { name: 'Klara and the Sun', exact: true })).toBeVisible();
});
