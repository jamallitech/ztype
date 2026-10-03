import { expect, type Page } from '@playwright/test';
export const firstWord = (page: Page) => page.getByTestId('threat-word').first().innerText();
export const freezeClock = async (page: Page) => {
  const time = new Date();
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
};

export const missionInput = (page: Page) =>
  page.getByRole('textbox', { name: 'Mission typing input' });

export async function start(page: Page, still = true, clock = false) {
  if (still) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/missions');
  await page.getByTestId('level-moon').click();
  await page.getByRole('button', { name: 'Begin rescue' }).waitFor();
  if (clock) await page.clock.install();
  await page.getByRole('button', { name: 'Begin rescue' }).click();
  await expect(missionInput(page)).toBeFocused();
}

export async function flyTo(page: Page, step = 'complete') {
  for (let i = 0; i < 140; i++) {
    const state = await page.getByTestId('mission-viewport').evaluate((el) => ({
      status: el.getAttribute('data-status'),
      step: el.getAttribute('data-step'),
      phase: el.getAttribute('data-phase'),
    }));
    if (state.step === step || state.status === 'won') return;
    expect(state.status).not.toBe('lost');
    if (state.status === 'paused') {
      await page.getByRole('button', { name: 'Resume mission' }).click();
    } else if (['launch', 'landing', 'walk', 'departure'].includes(state.phase!)) {
      try {
        await page.getByRole('button', { name: 'Skip sequence' }).click({ timeout: 1500 });
      } catch (error) {
        // Autopilot may finish while the browser scrolls to the button.
        if ((await page.getByTestId('mission-viewport').getAttribute('data-step')) === state.step)
          throw error;
      }
    } else {
      const word =
        state.phase === 'combat'
          ? await page.getByTestId('threat-word').first().textContent()
          : await page.getByTestId('mission-prompt').textContent();
      await missionInput(page).fill(word!);
    }
  }
  throw new Error(`Mission did not reach ${step}`);
}
