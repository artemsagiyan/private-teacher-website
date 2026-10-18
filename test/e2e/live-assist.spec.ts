import { test, expect } from '@playwright/test';

test.describe('live lesson assistant', () => {
  test.skip(!process.env.E2E_TEACHER_EMAIL || !process.env.E2E_TEACHER_PASSWORD || !process.env.E2E_LESSON_URL, 'Set E2E_TEACHER_EMAIL, E2E_TEACHER_PASSWORD and E2E_LESSON_URL');

  test('shows an AI task after board context changes', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_TEACHER_EMAIL!);
    await page.getByLabel(/парол/i).fill(process.env.E2E_TEACHER_PASSWORD!);
    await page.getByRole('button', { name: /войти/i }).click();
    await page.goto(process.env.E2E_LESSON_URL!);
    await expect(page.getByText(/Что решать/)).toBeVisible();
    await expect(page.locator('.lesson-room')).toBeVisible();
    await page.waitForTimeout(2_500);
    await expect(page.getByText(/ИИ:/)).toBeVisible({ timeout: 10_000 });
  });
});
