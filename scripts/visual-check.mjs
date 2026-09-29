import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const directory = 'test-results/visual';
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
try {
  await page.goto(base);
  await page.getByRole('textbox', { name: 'Typing input' }).waitFor();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${directory}/practice-desktop.png`, fullPage: true });
  await page.evaluate(() => {
    window.ztypeLatencies = [];
    document.querySelector('textarea').addEventListener('input', () => {
      const start = performance.now();
      requestAnimationFrame(() => window.ztypeLatencies.push(performance.now() - start));
    });
  });
  const prompt = (await page.getByTestId('typing-prompt').textContent()).replace(/\u00a0/g, ' ');
  await page
    .getByRole('textbox', { name: 'Typing input' })
    .pressSequentially(prompt.slice(0, 80), { delay: 45 });
  const performanceReport = await page.evaluate(async () => {
    const deltas = [];
    let previous = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        deltas.push(now - previous);
        previous = now;
        if (deltas.length < 120) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    const latencies = window.ztypeLatencies.sort((a, b) => a - b);
    return {
      p95InputToNextFrameMs: latencies[Math.floor(latencies.length * 0.95)],
      observedFps: 1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length),
      samples: latencies.length,
    };
  });
  for (const route of ['learn', 'progress', 'settings']) {
    await page.goto(`${base}/${route}`);
    await page.locator('h1').waitFor();
    await page.screenshot({ path: `${directory}/${route}-desktop.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`${base}/learn`);
  await page.locator('h1').waitFor();
  await page.screenshot({ path: `${directory}/learn-tablet.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.getByRole('textbox', { name: 'Typing input' }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${directory}/practice-mobile.png`, fullPage: true });
  await writeFile(
    `${directory}/report.json`,
    JSON.stringify({ errors, performanceReport }, null, 2),
  );
  console.log(JSON.stringify({ directory, errors, performanceReport }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
