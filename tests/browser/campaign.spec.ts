import { expect, test } from '@playwright/test';
import { missionDestinations } from '../../packages/core/src/campaign';
import { freezeClock, flyTo, start } from './mission-helpers';

test('the centered carousel previews neighbors, expands in place, and restores its position', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/missions');
  const carousel = page.getByTestId('destination-carousel');
  await expect(page.locator('[data-testid^="level-"]')).toHaveCount(12);
  await expect(carousel).toHaveAttribute('data-active', 'moon');
  await expect(page.getByTestId('destination-preview')).toHaveCount(0);
  const geometry = await page.getByTestId('level-moon').evaluate((card) => {
    const current = card.getBoundingClientRect();
    const stage = card.parentElement!.getBoundingClientRect();
    const next = card
      .parentElement!.querySelector('[data-testid="level-mars"]')!
      .getBoundingClientRect();
    return {
      centered: Math.abs(current.x + current.width / 2 - stage.x - stage.width / 2) < 2,
      large: current.width >= stage.width / 2,
      nextVisible: next.left < stage.right && next.right > stage.right,
    };
  });
  expect(geometry).toEqual({ centered: true, large: true, nextVisible: true });
  await page.getByTestId('level-moon').click();
  await expect(carousel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Begin rescue' })).toBeVisible();
  await page.getByRole('button', { name: 'Close mission details' }).click();
  await expect(page.getByTestId('destination-preview')).toHaveCount(0);
  await expect(page.getByTestId('level-moon')).toBeFocused();
  const card = (await page.getByTestId('level-moon').boundingBox())!;
  await page.mouse.move(card.x + card.width / 2 + 80, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 - 80, card.y + card.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(carousel).toHaveAttribute('data-active', 'mars');
  await expect(page.getByTestId('destination-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Previous destinations', exact: true }).click();
  await page.getByTestId('level-moon').focus();
  await page.keyboard.press('ArrowRight');
  await expect(carousel).toHaveAttribute('data-active', 'mars');
  await expect(page.getByTestId('level-mars')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Complete Moon to unlock Mars.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin rescue' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(carousel).toBeVisible();
  await expect(carousel).toHaveAttribute('data-active', 'mars');
  await expect(page.getByTestId('level-mars')).toBeFocused();
  // A neighboring, partly visible destination can be opened directly.
  const neighbor = await page.getByTestId('level-ceres').boundingBox();
  await page.getByTestId('level-ceres').click({ position: { x: 35, y: neighbor!.height / 2 } });
  await expect(page.getByTestId('destination-preview')).toHaveAttribute(
    'data-destination',
    'ceres',
  );
  await page.getByRole('button', { name: 'Close mission details' }).click();
  await expect(carousel).toHaveAttribute('data-active', 'ceres');
  await page.getByRole('button', { name: 'Show Pluto', exact: true }).click();
  await page.getByRole('button', { name: 'Next destinations', exact: true }).click();
  await expect(carousel).toHaveAttribute('data-active', 'moon');
  await page.goto('/missions?destination=pluto');
  await expect(page.getByText('Complete Triton to unlock Pluto.')).toBeVisible();
  for (const width of [320, 390, 820]) {
    await page.getByRole('button', { name: 'Close mission details' }).click();
    await expect(carousel).toBeVisible();
    await expect(page.getByTestId('level-pluto')).toBeFocused();
    await page.setViewportSize({ width, height: 900 });
    await page.getByTestId('level-pluto').focus();
    await page.keyboard.press('Home');
    await expect(carousel).toHaveAttribute('data-active', 'moon');
    await page.keyboard.press('End');
    await expect(page.getByTestId('level-pluto')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Pluto', exact: true })).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
});

test('a player can complete the entire campaign through Next mission and retain all unlocks after reload', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  await freezeClock(page);
  for (const mission of missionDestinations) {
    await expect(page.getByTestId('mission-viewport')).toHaveAttribute(
      'data-destination',
      mission.id,
    );
    await expect(page.getByTestId('mission-viewport')).toHaveAttribute('data-status', 'ready');
    await flyTo(page);
    await expect(
      page.getByRole('heading', { name: mission.successTitle, exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Mission saved on this device', { exact: true })).toBeVisible();
    const next = missionDestinations[mission.level];
    if (next) {
      await expect(
        page.getByText(`${next.name} unlocked. Your next rescue is ready.`),
      ).toBeVisible();
      await page.getByRole('button', { name: `Next mission: ${next.name}`, exact: true }).click();
    } else await expect(page.getByRole('button', { name: /Next mission:/ })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Level select', exact: true }).click();
  await expect(page.getByTestId('destination-preview')).toHaveCount(0);
  await expect(page.getByText('12 / 12 completed', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid^="level-"][data-unlocked="true"]')).toHaveCount(12);
  await page.clock.resume();
  await page.reload();
  await expect(page.getByText('12 / 12 completed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show Europa', exact: true }).click();
  await page.getByTestId('level-europa').click();
  await page.getByRole('button', { name: 'Replay mission' }).click();
  await expect(page.getByTestId('mission-viewport')).toHaveAttribute('data-destination', 'europa');
  expect(errors).toEqual([]);
});

test('an old Moon win unlocks Mars and survives a real result-history eviction', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/missions');
  await expect(page.getByTestId('level-moon')).toBeVisible();
  const sound = page.getByRole('switch', { name: 'Combat sound effects' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('ztype-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('profiles', 'readwrite');
      const store = transaction.objectStore('profiles');
      const request = store.get('guest');
      request.onsuccess = () => {
        const base = {
          missionId: 'moon-selene',
          contentVersion: 1,
          completedAt: '2026-09-01T12:00:00Z',
          difficulty: 'relaxed',
          pace: 15,
          outcome: 'lost',
          score: 0,
          stars: 0,
          accuracy: 80,
          wpm: 12,
          elapsedMs: 10000,
          typingMs: 10000,
          totalEntries: 10,
          correctEntries: 8,
          disabled: 1,
          shield: 0,
          rescued: 0,
        };
        const records = Array.from({ length: 99 }, (_, i) => ({ ...base, id: `old-loss-${i}` }));
        records.push({ ...base, id: 'legacy-win', outcome: 'won', stars: 1 });
        store.put({ ...request.result, campaign: undefined, missionRuns: records }, 'guest');
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByTestId('level-mars')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('level-ceres')).toHaveAttribute('data-unlocked', 'false');
  await page.getByRole('button', { name: 'Show Moon', exact: true }).click();
  await page.getByTestId('level-moon').click();
  await page.clock.install();
  await page.getByRole('button', { name: 'Replay mission' }).click();
  await flyTo(page, 'first-contact');
  await page.clock.fastForward(30_000);
  await page.clock.fastForward(300_000);
  await expect(
    page.getByRole('heading', { name: 'The next rescue starts with you.' }),
  ).toBeVisible();
  await expect(page.getByText('Mission saved on this device', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('level-mars')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('level-ceres')).toHaveAttribute('data-unlocked', 'false');
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('ztype-v1');
      request.onsuccess = () => resolve(request.result);
    });
    const value = await new Promise<{
      missionRuns: { id: string }[];
      campaign: Record<string, { stars: number }>;
    }>((resolve) => {
      const request = db.transaction('profiles').objectStore('profiles').get('guest');
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return value;
  });
  expect(stored.missionRuns).toHaveLength(100);
  expect(stored.missionRuns.some((r) => r.id === 'legacy-win')).toBe(false);
  expect(stored.campaign['moon-selene'].stars).toBe(1);
});
