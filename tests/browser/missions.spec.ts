import { expect, test } from '@playwright/test';
import { firstWord, freezeClock, missionInput, start, flyTo } from './mission-helpers';

test('rescue windows and oxygen are visible; pauses freeze them and ending early saves a partial result', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/missions?destination=moon');
  await expect(page.getByText('5:00 rescue window')).toBeVisible();
  await expect(
    page.getByTestId('destination-preview').getByText('O₂ 100% at launch'),
  ).toBeVisible();
  await page.goto('/missions?destination=io');
  await expect(page.getByText('2:00 rescue window')).toBeVisible();
  await start(page, true, true);
  await expect(page.getByTestId('mission-timer')).toHaveText('5:00');
  await expect(page.getByRole('meter', { name: 'Oxygen' })).toHaveAttribute('aria-valuenow', '100');
  await missionInput(page).fill('i');
  await page.clock.fastForward(75_000);
  await expect(page.getByTestId('mission-timer')).toHaveText('3:45');
  await expect(page.getByRole('meter', { name: 'Oxygen' })).toHaveAttribute('aria-valuenow', '75');
  await page.getByRole('button', { name: 'Pause mission' }).click();
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('mission-timer')).toHaveText('3:45');
  await expect(page.getByRole('meter', { name: 'Oxygen' })).toHaveAttribute('aria-valuenow', '75');
  await page.getByRole('dialog').getByRole('button', { name: 'End mission', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Back to safety.' })).toBeVisible();
  await expect(page.getByText('Mission saved on this device', { exact: true })).toBeVisible();
  await expect(page.getByLabel('0 / 3 Mission stars')).toBeVisible();
  await page.getByRole('button', { name: 'Level select', exact: true }).click();
  await expect(page.getByTestId('level-mars')).toHaveAttribute('data-unlocked', 'false');
  await page.clock.resume();
  await page.reload();
  await page.getByText('Mission history', { exact: false }).first().click();
  await expect(page.getByRole('table').getByText('Mission ended early')).toBeVisible();
});

test('oxygen warns at 25 percent, the deadline ends a run, and replay resets the suit', async ({
  page,
}) => {
  await start(page, true, true);
  await missionInput(page).fill('i');
  await page.clock.fastForward(225_000);
  await expect(page.getByRole('meter', { name: 'Oxygen' })).toHaveAttribute('aria-valuenow', '25');
  await expect(page.getByTestId('suit-vitals')).toHaveAttribute('data-condition', 'critical');
  await expect(page.getByText('SUIT CRITICAL')).toBeVisible();
  await page.clock.fastForward(75_000);
  await expect(
    page.getByRole('heading', { name: 'The next rescue starts with you.' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'The rescue window closed. Try clearing the objectives faster on your next run.',
    ),
  ).toBeVisible();
  await expect(page.getByTestId('mission-timer')).toHaveText('0:00');
  await page.getByRole('button', { name: 'Retry rescue' }).click();
  await expect(page.getByTestId('mission-timer')).toHaveText('5:00');
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(page.getByRole('meter', { name: 'Oxygen' })).toHaveAttribute('aria-valuenow', '100');
});

test('Moon rescue completes and replays three times, retains its own history, and charts Jupiter’s moons', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // Deadline behavior is covered separately; browser automation can type at
  // any speed here without changing a composition or persistence assertion.
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/missions');
  await expect(page.getByTestId('level-moon')).toBeVisible();
  await expect(page.locator('[data-testid^="level-"]')).toHaveCount(12);
  await expect(page.getByTestId('level-europa')).toHaveAttribute('data-unlocked', 'false');
  await page.getByTestId('level-moon').click();
  await page.getByRole('button', { name: 'Begin rescue' }).click();
  await freezeClock(page);
  const openingWords: string[] = [];
  for (let run = 0; run < 3; run++) {
    await expect(missionInput(page)).toHaveValue('');
    await expect(page.getByTestId('mission-viewport')).toHaveAttribute('data-status', 'ready');
    await flyTo(page, 'first-contact');
    openingWords.push(await firstWord(page));
    await flyTo(page);
    await expect(
      page.getByRole('heading', { name: 'One more person made it home.' }),
    ).toBeVisible();
    await expect(page.getByLabel('3 / 3 Mission stars')).toBeVisible();
    await expect(page.getByText('Mission saved on this device', { exact: true })).toBeVisible();
    if (run < 2) await page.getByRole('button', { name: 'Fly again' }).click();
  }
  expect(new Set(openingWords).size).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Level select', exact: true }).click();
  await page.getByText('Mission history', { exact: false }).first().click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);
  await page.clock.resume();
  await page.reload();
  await page.getByText('Mission history', { exact: false }).first().click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(4);
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('target lock, backspace, composition and paste protection work without losing accuracy penalties', async ({
  page,
}) => {
  await start(page);
  await freezeClock(page);
  await missionInput(page).pressSequentially('ignitx');
  await missionInput(page).press('Backspace');
  await missionInput(page).pressSequentially('e');
  await flyTo(page, 'first-contact');
  const word = await firstWord(page);
  await missionInput(page).pressSequentially(word.slice(0, 2));
  await expect(page.getByTestId('mission-prompt')).toHaveText(word);
  await missionInput(page).dispatchEvent('paste');
  await expect(missionInput(page)).toHaveValue(word.slice(0, 2));
  await expect(
    page.getByText('Use your keyboard for this rescue. Pasting is disabled.'),
  ).toBeVisible();
  await missionInput(page).dispatchEvent('compositionstart');
  await missionInput(page).evaluate((element, word) => {
    const input = element as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, word);
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: word.slice(2),
        isComposing: true,
        inputType: 'insertCompositionText',
      }),
    );
  }, word);
  await expect(page.getByTestId('threat-word')).toHaveText(word);
  await missionInput(page).dispatchEvent('compositionend', { data: word.slice(2) });
  // Some browsers send this final input after the composition commit.
  await missionInput(page).dispatchEvent('input', {
    data: word.slice(2),
    inputType: 'insertCompositionText',
    isComposing: false,
  });
  await expect(page.getByTestId('threat-word')).toHaveCount(2);
  const next = await page.getByTestId('threat-word').allTextContents();
  await missionInput(page).pressSequentially(next[1][0]);
  await expect(page.getByTestId('mission-prompt')).toHaveText(next[1]);
  await missionInput(page).press('Backspace');
  await missionInput(page).pressSequentially(next[0]);
  await expect(page.getByTestId('threat-word')).toHaveText(next[1]);
  await flyTo(page);
  await expect(page.getByRole('heading', { name: 'One more person made it home.' })).toBeVisible();
  await expect(
    page.getByText('Accuracy', { exact: true }).locator('..').getByText('100%', { exact: true }),
  ).toHaveCount(0);
});

test('Escape and tab blur freeze threats; suit failure has a clean retry', async ({ page }) => {
  await start(page, true, true);
  await flyTo(page, 'first-contact');
  const fragment = (await firstWord(page)).slice(0, 2);
  await missionInput(page).pressSequentially(fragment);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Take a breath, pilot.' })).toBeVisible();
  await page.clock.fastForward(120_000);
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await page.getByRole('button', { name: 'Resume mission' }).click();
  await expect(missionInput(page)).toHaveValue(fragment);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.fastForward(120_000);
  await page.getByRole('button', { name: 'Resume mission' }).click();
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '88',
  );
  await expect(missionInput(page)).toHaveValue('');
  for (let i = 0; i < 10 && (await missionInput(page).count()); i++)
    await page.clock.fastForward(15_000);
  await expect(
    page.getByRole('heading', { name: 'The next rescue starts with you.' }),
  ).toBeVisible();
  await expect(page.getByText('Mission saved on this device', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry rescue' }).click();
  await expect(missionInput(page)).toHaveValue('');
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toBeVisible();
  await expect(page.getByTestId('mission-viewport')).toHaveAttribute('data-status', 'ready');
});

test('a graphics context failure preserves input and the rescue can finish offline', async ({
  page,
  context,
}) => {
  await start(page, false);
  await missionInput(page).pressSequentially('ig');
  await page.waitForTimeout(700);
  const canvas = page.getByTestId('mission-viewport').locator('canvas');
  if (await canvas.count()) {
    await canvas.dispatchEvent('webglcontextlost', { cancelable: true });
    await expect(canvas).toHaveCount(0);
  }
  await expect(missionInput(page)).toHaveValue('ig');
  await context.setOffline(true);
  await flyTo(page);
  await expect(page.getByRole('heading', { name: 'One more person made it home.' })).toBeVisible();
  await expect(page.getByText('Mission saved on this device', { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('a failed 3D download leaves the complete mission playable', async ({ page }) => {
  await page.route(/\/src\/missions\/MissionScene\.tsx(?:\?|$)/, (route) => route.abort());
  await start(page, false);
  await flyTo(page, 'first-contact');
  await expect(page.getByText('STILL SCENE / MISSION ACTIVE')).toBeVisible();
  await flyTo(page);
  await expect(page.getByRole('heading', { name: 'One more person made it home.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload Ztype' })).toHaveCount(0);
});

test('mission controls and the destination map fit phones and tablets', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/missions');
    await expect(page.getByRole('heading', { name: 'Destinations', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `map at ${width}`,
    ).toBe(true);
    await page.getByTestId('level-moon').click();
    await page.getByRole('button', { name: 'Begin rescue' }).click();
    await flyTo(page, 'first-contact');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `mission at ${width}`,
    ).toBe(true);
    await page.getByRole('button', { name: 'Pause mission' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'End mission', exact: true })
      .click();
    await page.getByRole('button', { name: 'Level select', exact: true }).click();
  }
});

test('the wide cockpit keeps controls in view and can expand without resetting the run', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  const viewport = await page.getByTestId('mission-viewport').boundingBox();
  expect(viewport!.width).toBeGreaterThan(1300);
  expect(viewport!.height).toBeGreaterThan(650);
  await missionInput(page).pressSequentially('ig');
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await page.getByRole('button', { name: 'Expand mission view' }).click();
    await expect(page.getByRole('button', { name: 'Exit expanded view' })).toBeVisible();
    await expect(missionInput(page)).toHaveValue('ig');
    await page.getByRole('button', { name: 'Exit expanded view' }).click();
    await expect(page.getByRole('dialog', { name: 'Take a breath, pilot.' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume mission' }).click();
    await expect(missionInput(page)).toHaveValue('ig');
  }
  const field = await missionInput(page).boundingBox();
  expect(field!.y + field!.height).toBeLessThan(900);
});

test('shots and suit hits have visible feedback, including the still-scene fallback', async ({
  page,
}) => {
  await start(page, true, true);
  await flyTo(page, 'first-contact');
  await missionInput(page).fill(await firstWord(page));
  await expect(page.getByTestId('impact-feedback')).toHaveAttribute('data-impact', 'drone');
  await page.clock.fastForward(1100);
  await expect(page.getByTestId('impact-feedback')).toHaveCount(0);
  // The left drone arrives first; the staggered right drone is still approaching.
  for (let i = 0; i < 120 && (await page.getByTestId('impact-feedback').count()) === 0; i++)
    await page.clock.runFor(100);
  await expect(page.getByTestId('impact-feedback')).toHaveAttribute('data-impact', 'shield');
  await expect(page.getByRole('meter', { name: 'Health', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '78',
  );
});

test('combat synthesizes audible impacts and respects mute, zero volume, and pause', async ({
  page,
}) => {
  await page.addInitScript(() => {
    type Probe = { context: AudioContext; analyser: AnalyserNode; bursts: number };
    const monitor = window as unknown as { missionAudioProbe: Probe };
    window.AudioContext = new Proxy(window.AudioContext, {
      construct(Base, args) {
        const context = Reflect.construct(Base, args) as AudioContext;
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        const tap = context.createGain();
        tap.gain.value = 0;
        analyser.connect(tap);
        tap.connect(context.destination);
        const probe = (monitor.missionAudioProbe = { context, analyser, bursts: 0 });
        const compressor = context.createDynamicsCompressor.bind(context);
        context.createDynamicsCompressor = () => {
          const node = compressor();
          node.connect(analyser);
          return node;
        };
        const noise = context.createBufferSource.bind(context);
        context.createBufferSource = () => {
          probe.bursts++;
          return noise();
        };
        return context;
      },
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/missions');
  const sound = page.getByRole('switch', { name: 'Combat sound effects' });
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('level-moon').click();
  await page.getByRole('button', { name: 'Begin rescue' }).click();
  await flyTo(page, 'first-contact');
  const bursts = () =>
    page.evaluate(
      () =>
        (window as unknown as { missionAudioProbe: { bursts: number } }).missionAudioProbe.bursts,
    );
  const before = await bursts();
  await missionInput(page).fill(await firstWord(page));
  await expect.poll(bursts).toBeGreaterThanOrEqual(before + 3);
  const peak = await page.evaluate(async () => {
    const { analyser } = (window as unknown as { missionAudioProbe: { analyser: AnalyserNode } })
      .missionAudioProbe;
    const samples = new Float32Array(512);
    let peak = 0;
    for (let i = 0; i < 16; i++) {
      analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, ...samples.map(Math.abs));
      await new Promise(requestAnimationFrame);
    }
    return peak;
  });
  expect(peak).toBeGreaterThan(0.001);
  await page.getByRole('button', { name: 'Mute mission sound' }).click();
  await expect(page.getByRole('button', { name: 'Enable mission sound' })).toBeVisible();
  const muted = await bursts();
  await missionInput(page).fill(await firstWord(page));
  expect(await bursts()).toBe(muted);
  await page.getByRole('button', { name: 'Enable mission sound' }).click();
  const volume = page.getByRole('slider', { name: 'Mission volume' });
  await volume.focus();
  await volume.press('Home');
  await expect(volume).toHaveValue('0');
  const quiet = await bursts();
  await missionInput(page).fill(await firstWord(page));
  expect(await bursts()).toBe(quiet);
  await page.getByRole('button', { name: 'Pause mission' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { missionAudioProbe: { context: AudioContext } }).missionAudioProbe
            .context.state,
      ),
    )
    .toBe('suspended');
});
