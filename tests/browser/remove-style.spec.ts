import { expect, test } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`removing a prepared style preserves photos and timings on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/'); await page.evaluate(() => window.studioTest.seed()); await page.goto('/?ui');
    await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
    const before = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background);
    await page.getByRole('button', { name: 'Estilo', exact: true }).click();
    await page.getByRole('button', { name: /Rock Galego/ }).click();
    await expect.poll(async () => (await page.evaluate(() => window.studioTest.savedProjects()))[0].settings.visualStyle).toBe('rock-galego');
    await page.getByRole('button', { name: 'Quitar estilo preparado', exact: true }).click();
    await expect.poll(async () => (await page.evaluate(() => window.studioTest.savedProjects()))[0].settings.visualStyle).toBe('default');
    const saved = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background);
    expect(saved.type).toBe(before.type);
    expect(saved.images).toEqual(before.images);
    expect(saved.imageClips).toEqual(before.imageClips);
    expect(saved.photoClips).toEqual(before.photoClips);
    await page.reload(); await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
    const reopened = await page.evaluate(async () => (await window.studioTest.savedProjects())[0].settings.background);
    expect(reopened.imageClips).toEqual(before.imageClips);
    expect(reopened.photoClips).toEqual(before.photoClips);
  });
}
