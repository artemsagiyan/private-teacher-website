import { expect, test } from '@playwright/test';

test('главная реагирует на запись в демо-слот', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Занятие, расписание и отчёт/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /18:00/ }).click();
  await expect(page.getByText('Вы записаны на 18:00')).toBeVisible();
});

test('преподаватель входит и открывает кабинет', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('teacher@tutor.local');
  await page.getByLabel('Пароль').fill('Teacher12345');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/dashboard\/teacher/);
  await expect(page.getByRole('heading').first()).toBeVisible();
});

test('урок не получает 401 от LiveKit и не сыпет 409 на доску', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/rtc/validate') && response.status() === 401) {
      failures.push(`validate ${response.status()}`);
    }
    if (url.includes('/board') && response.status() === 409) {
      failures.push(`board ${response.status()}`);
    }
  });

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('teacher@tutor.local');
  await page.getByLabel('Пароль').fill('Teacher12345');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/dashboard\/teacher/);

  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  const slots = await page.request.get('http://localhost:3001/api/calendar/teacher', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = (await slots.json()) as Array<{ id: string; startTime: string }>;
  const upcoming = list
    .filter((slot) => new Date(slot.startTime).getTime() > Date.now() - 60 * 60_000)
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )[0];
  expect(upcoming, 'нет ближайшего слота').toBeTruthy();
  if (!upcoming) return;
  await page.goto(`/dashboard/teacher/lesson/${upcoming.id}?view=video`);
  await page.waitForTimeout(6000);
  expect(failures, failures.join(', ')).toEqual([]);
});
