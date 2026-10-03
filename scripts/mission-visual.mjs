import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const directory = 'test-results/missions';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch(
  existsSync('/Applications/Google Chrome.app') ? { channel: 'chrome' } : {},
);
const page = await browser.newPage({
  viewport: { width: 1440, height: 1040 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = process.env.ZTYPE_VISUAL_URL || 'http://127.0.0.1:5173';
const input = page.getByRole('textbox', { name: 'Mission typing input' });
async function flyTo(step) {
  for (let i = 0; i < 140; i++) {
    const state = await page.getByTestId('mission-viewport').evaluate((el) => ({
      step: el.dataset.step,
      phase: el.dataset.phase,
      status: el.dataset.status,
    }));
    if (state.step === step || state.status === 'won') return;
    if (state.status === 'lost') throw new Error('Rescue failed');
    if (state.status === 'paused')
      await page.getByRole('button', { name: 'Resume mission' }).click();
    else if (['launch', 'landing', 'walk', 'departure'].includes(state.phase)) {
      try {
        await page.getByRole('button', { name: 'Skip sequence' }).click({ timeout: 1500 });
      } catch (error) {
        if ((await page.getByTestId('mission-viewport').getAttribute('data-step')) === state.step)
          throw error;
      }
    } else
      await input.fill(
        await page
          .getByTestId(state.phase === 'combat' ? 'threat-word' : 'mission-prompt')
          .first()
          .textContent(),
      );
  }
  throw new Error(`Failed to reach ${step}`);
}
const screenshot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
};
try {
  await page.goto(`${base}/missions`);
  await page.getByTestId('level-moon').waitFor();
  await screenshot('mission-control');
  await page.getByRole('switch', { name: 'Combat sound effects' }).click();
  await page.getByTestId('level-moon').click();
  await page.getByRole('button', { name: 'Begin rescue' }).click();
  await page.waitForTimeout(1800);
  const webgl = (await page.getByTestId('mission-viewport').locator('canvas').count()) > 0;
  await screenshot('ignition');
  await input.pressSequentially('ignite', { delay: 160 });
  await page.waitForTimeout(1500);
  await screenshot('launch');
  await flyTo('landing');
  await page.waitForTimeout(900);
  await screenshot('landing');
  await flyTo('beacon');
  await page.waitForTimeout(1600);
  await screenshot('surface');
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await page.getByRole('button', { name: 'Expand mission view' }).click();
    await page.getByRole('button', { name: 'Exit expanded view' }).waitFor();
    await page.waitForTimeout(250);
    await screenshot('fullscreen');
    await page.getByRole('button', { name: 'Exit expanded view' }).click();
    await page.getByRole('button', { name: 'Resume mission' }).click();
  }
  await page.evaluate(() => {
    window.missionLatencies = [];
    document.querySelector('textarea').addEventListener('input', () => {
      const start = performance.now();
      requestAnimationFrame(() => window.missionLatencies.push(performance.now() - start));
    });
  });
  const prompt = await page.getByTestId('mission-prompt').textContent();
  await input.pressSequentially(prompt.slice(0, -1), { delay: 60 });
  const performanceReport = await page.evaluate(async () => {
    const deltas = [];
    let previous = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        deltas.push(now - previous);
        previous = now;
        if (deltas.length < 120) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    const times = window.missionLatencies.sort((a, b) => a - b);
    return {
      p95InputToNextFrameMs: times[Math.floor(times.length * 0.95)],
      observedFps: 1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length),
      samples: times.length,
    };
  });
  await flyTo('first-contact');
  await input.pressSequentially(await page.getByTestId('threat-word').first().innerText(), {
    delay: 75,
  });
  await screenshot('drone-impact');
  await page.waitForTimeout(400);
  await screenshot('drone-encounter');
  await input.fill(await page.getByTestId('threat-word').first().innerText());
  await screenshot('rock-impact');
  while ((await page.getByTestId('threat-word').count()) < 3)
    await input.fill(await page.getByTestId('threat-word').first().innerText());
  await screenshot('mixed-threats');
  await flyTo('survivor');
  await page.waitForTimeout(1000);
  await screenshot('survivor');
  await flyTo('last-wave');
  await screenshot('three-drone-wave');
  await flyTo('complete');
  await page.getByRole('heading', { name: 'One more person made it home.' }).waitFor();
  await screenshot('rescue-complete');
  await page.getByRole('button', { name: 'Fly again' }).click();
  await flyTo('first-contact');
  await page
    .locator('[data-testid="impact-feedback"][data-impact="shield"]')
    .waitFor({ timeout: 12000 });
  await screenshot('shield-impact');
  await page.getByRole('button', { name: 'Pause mission' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'End mission', exact: true }).click();
  await page.getByRole('button', { name: 'Level select', exact: true }).click();
  await page.setViewportSize({ width: 820, height: 1180 });
  await screenshot('tablet');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('mobile');
  await writeFile(
    `${directory}/report.json`,
    JSON.stringify({ webgl, errors, performanceReport }, null, 2),
  );
  console.log(JSON.stringify({ directory, webgl, errors, performanceReport }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
