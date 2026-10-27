import { expect, test } from '@playwright/test';

for (const target of ['mobile', 'pc', 'reel'] as const) {
  test(`real ${target} MP4: resolution, cover, index, seek and final lyrics`, async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(target => window.studioTest.exportFixture(target === 'reel' ? 'mobile' : target, target === 'reel'), target);
    expect([result.width, result.height]).toEqual(target !== 'pc' ? [1080, 1920] : [1920, 1080]);
    expect(result.size).toBeGreaterThan(10000);
    expect(result.drawn).not.toContain('NO EXPORTAR');
    expect(result.duration).toBeGreaterThan(5.5);
    expect(result.duration).toBeLessThan(7);
    expect(result.boxes).toContain('moov'); expect(result.boxes).toContain('mdat');
    expect(result.boxes).not.toContain('moof');
    expect(result.boxes.indexOf('moov')).toBeLessThan(result.boxes.indexOf('mdat'));
    expect(result.drawn).toEqual(expect.arrayContaining(['PRIMERA', 'SEGUNDA', 'ULTIMA']));
    for (const frame of result.sampleFrames) {
      expect(frame.whitePixels).toBeGreaterThan(500);
      for (const corner of frame.corners) { expect(corner[0]).toBeGreaterThan(120); expect(corner[1]).toBeLessThan(90); }
    }
    expect(new Set(result.sampleFrames.slice(0, 3).map(frame => frame.signature)).size).toBe(3);
    expect(result.sampleFrames.map(frame => frame.time)).toEqual([0.8, 2.8, 5.3, 1.2]);
    expect(result.audioRestored).toBe(true);
    expect(result.audioTracks).toBe(1);
  });
}

test('later manual image intervals continue rendering', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.studioTest.renderIntervals())).toEqual([[255, 0, 0, 255], [0, 0, 255, 255]]);
});

test('lyrics advance through a five-minute song despite overlapping old timestamps', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.studioTest.renderLongLyrics())).toEqual(['LINEA-0', 'LINEA-24', 'LINEA-36', 'LINEA-59']);
});
