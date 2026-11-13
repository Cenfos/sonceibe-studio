import { expect, test } from '@playwright/test';

for (const mode of ['manual', 'auto', 'style'] as const) {
  test(`timeline shows the style and ${mode} background below punctual photos`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async mode => {
      await window.studioTest.seed();
      const key = 'sonceibe-projects-v2:owner';
      const projects = JSON.parse(localStorage.getItem(key)!);
      const settings = projects[0].settings;
      settings.visualStyle = 'rock-galego';
      settings.background.imageMode = mode === 'manual' ? 'manual' : 'auto';
      settings.background.imageDuration = 5;
      if (mode === 'style') settings.background.type = 'gradient';
      localStorage.setItem(key, JSON.stringify(projects));
    }, mode);
    await page.goto('/?ui');
    await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
    const timeline = page.getByRole('region', { name: 'Línea de tiempo', exact: true });
    await expect(timeline.locator('.studio-timeline-labels > div')).toHaveText(['', 'Audio', 'Letra', 'Fotos puntuales', 'Fondo']);
    const style = timeline.getByRole('group', { name: 'Estilo · Rock Galego', exact: true });
    await expect(style).toBeVisible();
    await expect(style.getByRole('slider')).toHaveCount(0);
    const photo = timeline.getByRole('group', { name: 'Foto puntual 1', exact: true });
    const lyric = timeline.getByRole('group', { name: 'Letra 1', exact: true });
    expect((await lyric.boundingBox())!.y).toBeLessThan((await photo.boundingBox())!.y);
    expect((await photo.boundingBox())!.y).toBeLessThan((await style.boundingBox())!.y);
    if (mode === 'manual') {
      const image = timeline.getByRole('group', { name: 'Imagen múltiple 1', exact: true });
      await expect(image).toContainText('1.0–5.0 s');
      expect((await photo.boundingBox())!.y).toBeLessThan((await image.boundingBox())!.y);
      expect((await image.boundingBox())!.y).toBeLessThan((await style.boundingBox())!.y);
      await image.getByRole('slider', { name: 'Inicio de Imagen múltiple 1', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(timeline.getByRole('spinbutton', { name: 'Inicio de selección' })).toHaveValue('1.1');
      await page.screenshot({ path: 'test-results/timeline-style-and-photos.png' });
    } else if (mode === 'auto') {
      await expect(timeline.getByRole('group', { name: 'Imagen múltiple 1 · 0.0–5.0 s', exact: true })).toBeVisible();
      await expect(timeline.getByRole('group', { name: 'Imagen múltiple 1 · 5.0–10.0 s', exact: true })).toBeVisible();
    } else {
      await expect(timeline.getByRole('group', { name: /^Imagen múltiple/ })).toHaveCount(0);
    }
  });
}
