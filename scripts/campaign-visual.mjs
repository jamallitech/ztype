import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const directory = 'test-results/campaign';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch(
  existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {},
);
const page = await browser.newPage({
  viewport: { width: 1440, height: 1040 },
  deviceScaleFactor: 1,
});
const base = process.env.ZTYPE_VISUAL_URL || 'http://127.0.0.1:5173';
const worlds = [
  ['moon', 'moon-selene'],
  ['mars', 'mars-ares'],
  ['ceres', 'ceres-occator'],
  ['callisto', 'callisto-valhalla'],
  ['ganymede', 'ganymede-galileo'],
  ['europa', 'europa-thalassa'],
  ['io', 'io-prometheus'],
  ['titan', 'titan-huygens'],
  ['enceladus', 'enceladus-tiger'],
  ['titania', 'titania-messina'],
  ['triton', 'triton-nereid'],
  ['pluto', 'pluto-sputnik'],
];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const screenshot = async (name) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
};
try {
  await page.goto(`${base}/missions`);
  await page.getByTestId('level-moon').waitFor();
  await screenshot('catalog');
  await page.getByTestId('level-moon').click();
  await screenshot('expanded-preview');
  await page.getByRole('button', { name: 'Close mission details' }).click();
  await page.getByRole('button', { name: 'Show Europa', exact: true }).click();
  await page.getByTestId('level-europa').click();
  await screenshot('locked-preview');
  // Visual fixtures unlock each scene in this isolated browser profile only.
  // Sequential unlock behavior is tested by playing all 12 levels in campaign.spec.ts.
  await page.evaluate(async (worlds) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ztype-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      const store = transaction.objectStore('profiles');
      const request = store.get('guest');
      request.onsuccess = () => {
        const current = request.result ?? {
          attempts: [],
          progress: {
            totalSessions: 0,
            totalPracticeMs: 0,
            bests: {},
            masteredLessons: [],
            badges: [],
          },
          pending: [],
          preferencesPending: false,
          displayName: 'Explorer',
        };
        store.put(
          {
            ...current,
            preferences: { scene: 'space', sound: false, volume: 0.25, showLiveStats: true },
            campaign: Object.fromEntries(
              worlds.map(([, id]) => [id, { stars: 3, completedAt: '2026-09-30T00:00:00Z' }]),
            ),
          },
          'guest',
        );
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, worlds);
  const scenes = [];
  for (const [world] of worlds) {
    await page.goto(`${base}/missions?destination=${world}`);
    await page.getByRole('button', { name: 'Replay mission' }).click();
    const viewport = page.getByTestId('mission-viewport');
    await viewport.locator('canvas').waitFor({ timeout: 15000 });
    const input = page.getByRole('textbox', { name: 'Mission typing input' });
    await input.fill('ignite');
    for (let i = 0; i < 8; i++) {
      const step = await viewport.getAttribute('data-step');
      if (step === 'beacon') break;
      try {
        await page.getByRole('button', { name: 'Skip sequence' }).click({ timeout: 1500 });
      } catch (error) {
        if ((await viewport.getAttribute('data-step')) === step) throw error;
      }
    }
    await page.waitForTimeout(650);
    await screenshot(`${world}-surface`);
    if (world === 'moon' || world === 'io' || world === 'enceladus') {
      const frames = await page.evaluate(async () => {
        let count = 0;
        let previous = performance.now();
        const start = previous;
        const gaps = [];
        await new Promise((resolve) => {
          const frame = (now) => {
            gaps.push(now - previous);
            previous = now;
            if (++count < 90) requestAnimationFrame(frame);
            else resolve();
          };
          requestAnimationFrame(frame);
        });
        return { fps: 90000 / (previous - start), p95FrameMs: gaps.sort((a, b) => a - b)[85] };
      });
      scenes.push({ world, ...frames });
    }
    await page.getByRole('button', { name: 'Pause mission' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'End mission', exact: true })
      .click();
    await page.getByRole('button', { name: 'Level select', exact: true }).click();
  }
  // Inspect actual accumulated damage and the critical-health visor treatment.
  await page.clock.install();
  await page.goto(`${base}/missions?destination=moon`);
  await page.getByRole('button', { name: 'Replay mission' }).click();
  const combatViewport = page.getByTestId('mission-viewport');
  await combatViewport.locator('canvas').waitFor();
  const combatInput = page.getByRole('textbox', { name: 'Mission typing input' });
  await combatInput.fill('ignite');
  await page.getByTestId('mission-prompt').waitFor({ state: 'visible' });
  for (let i = 0; i < 10; i++) {
    const phase = await combatViewport.getAttribute('data-phase');
    if (phase === 'combat') break;
    if (['launch', 'landing', 'walk'].includes(phase)) {
      try {
        await page.getByRole('button', { name: 'Skip sequence' }).click({ timeout: 1500 });
      } catch {
        /* The short transition may have finished. */
      }
    } else await combatInput.fill(await page.getByTestId('mission-prompt').innerText());
  }
  for (let i = 0; i < 50; i++) {
    const health = Number(
      await page.getByRole('meter', { name: 'Health', exact: true }).getAttribute('aria-valuenow'),
    );
    if (health <= 25) break;
    await page.clock.fastForward(1000);
  }
  await page.waitForTimeout(300);
  await screenshot('critical-suit');
  await page.clock.resume();
  await page.getByRole('button', { name: 'End mission', exact: true }).click();
  await page.getByRole('heading', { name: 'Back to safety.' }).waitFor();
  await screenshot('partial-result');
  await page.goto(`${base}/missions`);
  await page.getByRole('heading', { name: 'Destinations', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('mobile-catalog');
  await page.setViewportSize({ width: 820, height: 1180 });
  await screenshot('tablet-catalog');
  const report = { worlds: worlds.length, errors, performance: scenes };
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
