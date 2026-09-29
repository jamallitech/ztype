import { expect, test, type Page } from '@playwright/test';

async function verificationLink(email: string) {
  const response = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-ztype/oobCodes');
  const data = await response.json();
  const code = data.oobCodes.findLast(
    (item: { email: string; requestType: string }) =>
      item.email === email && item.requestType === 'VERIFY_EMAIL',
  );
  return `http://127.0.0.1:4174/auth/action?mode=verifyEmail&oobCode=${code.oobCode}`;
}
async function signup(page: Page, email: string) {
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Our-little-orbit-123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox.' })).toBeVisible();
  await expect(
    page.getByText('A verification link is on its way.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close account dialog' }).click();
}

test('guest import, real email verification, account isolation, and offline retry', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'words', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  const prompt = (await page.getByTestId('typing-prompt').textContent())!.replace(/\u00a0/g, ' ');
  await page.getByRole('textbox', { name: 'Typing input' }).pressSequentially(prompt, { delay: 8 });
  await expect(page.getByRole('status')).toContainText('Test complete');
  const email = `explorer-${crypto.randomUUID()}@example.com`;
  await signup(page, email);
  await expect(page.getByText('One small step left:', { exact: false })).toBeVisible();
  await page.goto(await verificationLink(email));
  await expect(page.getByText('Your email is verified.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Import guest progress' }).click();
  await expect(page.getByText('Your guest journeys are now part of your account.')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'words', exact: true }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  const secondPrompt = (await page.getByTestId('typing-prompt').textContent())!.replace(
    /\u00a0/g,
    ' ',
  );
  await context.setOffline(true);
  await page
    .getByRole('textbox', { name: 'Typing input' })
    .pressSequentially(secondPrompt, { delay: 8 });
  await expect(page.getByRole('status')).toContainText('Test complete');
  await context.setOffline(false);
  await expect(page.getByText('Your journey is saved', { exact: false })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Explorer', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Your story starts with a single word.')).toBeVisible();
  const secondEmail = `second-${crypto.randomUUID()}@example.com`;
  await signup(page, secondEmail);
  await page.goto(await verificationLink(secondEmail));
  await expect(page.getByText('Your email is verified.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.getByText('Your story starts with a single word.')).toBeVisible();
});

test('password reset and expired verification links have usable recovery', async ({ page }) => {
  const email = `reset-${crypto.randomUUID()}@example.com`;
  await page.goto('/');
  await signup(page, email);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('If that email has an account,', { exact: false })).toBeVisible();
  const codes = await (
    await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-ztype/oobCodes')
  ).json();
  const code = codes.oobCodes.findLast(
    (item: { email: string; requestType: string }) =>
      item.email === email && item.requestType === 'PASSWORD_RESET',
  );
  await page.goto(`/auth/action?mode=resetPassword&oobCode=${code.oobCode}`);
  await page.getByLabel('New password', { exact: true }).fill('A-new-little-orbit-123');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByText('Your password has been updated.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to your account' }).click();
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('A-new-little-orbit-123');
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Continue to your account' }).click();
  await expect(page.getByRole('dialog')).toContainText(email);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close account dialog' }).click();
  await page.goto('/auth/action?mode=verifyEmail&oobCode=expired');
  await expect(page.getByRole('alert')).toContainText(
    'This link is invalid or has already been used.',
  );
});
