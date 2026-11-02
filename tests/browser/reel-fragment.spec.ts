import { expect, test } from '@playwright/test';

test('new Reel guides selection from repeated lyrics and then shows only the confirmed interval', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.studioTest.seed();
    const key = 'sonceibe-projects-v2:owner';
    const projects = JSON.parse(localStorage.getItem(key)!);
    projects[0].settings.lyrics = [
      { id: 'before', text: 'No está en el Reel', start: 2, end: 5 },
      { id: 'chorus1', text: 'Volvemos a cantar juntos', start: 40, end: 44 },
      { id: 'chorus2', text: 'Volvemos a cantar juntos', start: 90, end: 94 },
    ];
    localStorage.setItem(key, JSON.stringify(projects));
  });
  await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  const guide = page.getByRole('region', { name: 'Creación guiada de vídeo' });
  await expect(guide).toContainText('Esta frase se repite');
  await expect(guide.getByLabel('Situar fragmento de 30 segundos')).toHaveValue('40');
  await expect(guide.getByRole('button', { name: 'Continuar', exact: true })).toBeDisabled();
  await guide.getByRole('button', { name: 'Usar este fragmento', exact: true }).click();
  const crop = guide.getByLabel('Sólo el tramo seleccionado', { exact: true });
  await expect(crop).toBeVisible();
  await expect(crop).toContainText('Volvemos a cantar juntos');
  await expect(crop).not.toContainText('No está en el Reel');
  await expect(guide.getByLabel('Posición dentro del fragmento')).toHaveAttribute('min', '40');
  await expect(guide.getByLabel('Posición dentro del fragmento')).toHaveAttribute('max', '70');
  await guide.getByRole('button', { name: 'Elegir otro fragmento', exact: true }).click();
  await guide.getByLabel('Situar fragmento de 30 segundos').fill('60');
  await guide.getByRole('button', { name: 'Conservar selección anterior' }).click();
  await expect(guide.getByLabel('Posición dentro del fragmento')).toHaveAttribute('min', '40');
  await page.screenshot({ path: 'test-results/reel-selected-fragment.png' });
});

test('existing saved cut stays unchanged when opening Fragmento', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await window.studioTest.seed();
    const key = 'sonceibe-projects-v2:owner';
    const projects = JSON.parse(localStorage.getItem(key)!);
    projects[0].settings.reel = { start: 75, end: 92, coverUrl: '', showLyrics: true, showTitle: true };
    localStorage.setItem(key, JSON.stringify(projects));
  });
  await page.goto('/?ui');
  await page.getByRole('heading', { name: 'Prueba Studio', exact: true }).click();
  await page.getByRole('button', { name: 'Reel', exact: true }).click();
  await expect(page.getByLabel('Posición dentro del fragmento')).toHaveAttribute('min', '75');
  await expect(page.getByLabel('Posición dentro del fragmento')).toHaveAttribute('max', '92');
  await expect(page.getByRole('button', { name: 'Usar este fragmento', exact: true })).toHaveCount(0);
});
