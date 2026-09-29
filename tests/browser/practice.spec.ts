import { expect, test, type Page } from '@playwright/test';

async function shortTest(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'words', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(/\u00a0/g, ' ');
  await page
    .getByRole('textbox', { name: 'Typing input' })
    .pressSequentially(prompt, { delay: 12 });
  await expect(
    page.getByRole('heading', { name: 'A little better than yesterday.' }),
  ).toBeVisible();
}

test('a guest completes a test and retains history and badges after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await shortTest(page);
  await expect(page.getByRole('status')).toContainText('100% accuracy');
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await expect(page.getByText('First flight', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('timer begins with input, survives blur, and completes at the selected duration', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: '15', exact: true }).click();
  await page.clock.fastForward(20_000);
  await expect(page.getByRole('button', { name: 'Restart test' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Typing input' }).pressSequentially('a test');
  await page.getByRole('textbox', { name: 'Typing input' }).press('Escape');
  await page.clock.fastForward(16_000);
  await expect(
    page.getByRole('heading', { name: 'A little better than yesterday.' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Test complete');
});

test('mistakes remain in accuracy after backspacing and paste is prevented', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'words', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Typing input' });
  const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(/\u00a0/g, ' ');
  await input.pressSequentially('X');
  await input.press('Backspace');
  await input.dispatchEvent('paste');
  await expect(
    page.getByText('This little journey is for your fingers. Pasting is disabled.'),
  ).toBeVisible();
  await input.pressSequentially(prompt, { delay: 12 });
  await expect(page.getByRole('status')).toContainText('1 mistakes');
  await expect(page.getByRole('status')).not.toContainText('100% accuracy');
});

test('lessons can be mastered in any order and show the keyboard guide', async ({ page }) => {
  await page.goto('/learn');
  await page.getByRole('link', { name: /Ready for countdown/ }).click();
  await expect(page.getByLabel('QWERTY keyboard. Practice keys: 1234567890')).toBeVisible();
  const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(/\u00a0/g, ' ');
  await page
    .getByRole('textbox', { name: 'Typing input' })
    .pressSequentially(prompt, { delay: 12 });
  await expect(page.getByRole('heading', { name: 'A new skill in your orbit.' })).toBeVisible();
  await page.getByRole('link', { name: 'Learn', exact: true }).click();
  await expect(page.getByRole('link', { name: /Ready for countdown/ })).toContainText('Mastered');
});

for (const mode of ['lesson', 'words', 'time'] as const) {
  test(`${mode} results appear and save on three consecutive attempts`, async ({ page }) => {
    if (mode === 'time') await page.clock.install();
    await page.goto(mode === 'lesson' ? '/?lesson=home' : '/');
    if (mode === 'words') {
      await page.getByRole('button', { name: 'words', exact: true }).click();
      await page.getByRole('button', { name: '10', exact: true }).click();
    } else if (mode === 'time') {
      await page.getByRole('button', { name: '15', exact: true }).click();
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const input = page.getByRole('textbox', { name: 'Typing input' });
      await expect(input).toBeVisible();
      await expect(input).toHaveValue('');
      const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(
        /\u00a0/g,
        ' ',
      );
      await input.pressSequentially(mode === 'time' ? prompt.slice(0, 15) : prompt, { delay: 10 });
      if (mode === 'time') await page.clock.fastForward(16_000);
      await expect(page.getByRole('status')).toContainText('Test complete');
      await expect(page.getByRole('status')).toContainText('100% accuracy');
      if (attempt < 2) await page.getByRole('button', { name: 'Another little journey' }).click();
    }
    await page.getByRole('link', { name: 'Progress', exact: true }).click();
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);
    await page.reload();
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);
  });
}

test('reduced motion defaults to focus and preferences persist', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByLabel('Space companion: a journey to Kepler')).toHaveCount(0);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Live performance' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('switching modes after a result and restarting mid-test create clean attempts', async ({
  page,
}) => {
  await shortTest(page);
  await page.getByRole('button', { name: '25', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Typing input' });
  await input.pressSequentially('unfinished');
  await page.getByRole('button', { name: 'Restart test' }).click();
  await expect(input).toHaveValue('');
  const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(/\u00a0/g, ' ');
  await input.pressSequentially(prompt, { delay: 8 });
  await expect(page.getByRole('status')).toContainText('100% accuracy');
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
});

test('losing the graphics context preserves the active typing attempt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'words', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Typing input' });
  const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(/\u00a0/g, ' ');
  await input.pressSequentially(prompt.slice(0, 8));
  const canvas = page.getByLabel('Space companion: a journey to Kepler').locator('canvas');
  // Engines without WebGL already exercise the static fallback.
  if (await canvas.count()) {
    await canvas.dispatchEvent('webglcontextlost', { cancelable: true });
    await expect(canvas).toHaveCount(0);
  }
  await expect(input).toHaveValue(prompt.slice(0, 8));
  await input.pressSequentially(prompt.slice(8), { delay: 12 });
  await expect(page.getByRole('status')).toContainText('100% accuracy');
});

test('storage and WebGL failures leave practice usable', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof getContext>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return getContext.apply(this, args);
    } as typeof getContext;
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new Error('Blocked');
      },
    });
  });
  await shortTest(page);
  await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable');
});

test('account preview explains availability and modal supports Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/Accounts aren’t available on this preview/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mobile navigation, progress and settings fit the viewport', async ({ page }) => {
  for (const width of [320, 390, 820]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/learn', '/progress', '/settings']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      if (width < 560 && route === '/')
        await expect(page.getByText('A little room for your keyboard.')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} at ${width}px`,
      ).toBe(true);
    }
  }
});

test('an in-progress guest test completes without the network', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'words', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(/\u00a0/g, ' ');
  const input = page.getByRole('textbox', { name: 'Typing input' });
  await input.pressSequentially(prompt.slice(0, 1));
  await context.setOffline(true);
  await input.pressSequentially(prompt.slice(1), { delay: 12 });
  await expect(page.getByRole('status')).toContainText('100% accuracy');
  await context.setOffline(false);
});

test('a failed 3D download cannot replace the typing screen', async ({ page }) => {
  await page.route(/\/src\/components\/SpaceScene\.tsx(?:\?|$)/, (route) => route.abort());
  await shortTest(page);
  await expect(page.getByRole('status')).toContainText('100% accuracy');
  await page.getByRole('button', { name: 'Another little journey' }).click();
  await expect(page.getByRole('textbox', { name: 'Typing input' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload Ztype' })).toHaveCount(0);
});
