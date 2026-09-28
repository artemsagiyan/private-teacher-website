import { expect, test, type Page } from '@playwright/test';

const ACCOUNTS = {
  student: { email: 'student@tutor.local', password: 'Student12345' },
  teacher: { email: 'teacher@tutor.local', password: 'Teacher12345' },
  admin: { email: 'admin@tutor.local', password: 'Admin12345' },
};

async function login(page: Page, role: keyof typeof ACCOUNTS) {
  const account = ACCOUNTS[role];
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Пароль').fill(account.password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(new RegExp(`/dashboard/${role}`));
}

async function expectHealthy(page: Page, path: string) {
  const failures: string[] = [];
  const onResponse = (response: { url: () => string; status: () => number }) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    if (response.status() >= 500) failures.push(`${response.status()} ${url}`);
  };
  page.on('response', onResponse);
  await page.goto(path);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
  const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
  if (await errorToast.count()) {
    failures.push(await errorToast.first().innerText());
  }
  page.off('response', onResponse);
  expect(failures, path).toEqual([]);
}

test.describe.configure({ mode: 'serial' });

test('публичные страницы открываются', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Занятие, расписание и отчёт/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /18:00/ }).click();
  await expect(page.getByText('Вы записаны на 18:00')).toBeVisible();

  await page.goto('/contacts');
  await expect(page.getByRole('heading', { name: 'Контакты' })).toBeVisible();
  await expect(page.getByRole('link', { name: /hello@easyphys.ru/ })).toBeVisible();

  await page.goto('/auth/forgot-password');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.goto('/auth/register');
  await expect(page.getByRole('heading', { name: 'Создать аккаунт' })).toBeVisible();
});

test('неверный пароль не пускает внутрь', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(ACCOUNTS.student.email);
  await page.getByLabel('Пароль').fill('WrongPass123');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByText(/Неверный email или пароль|ошиб/i)).toBeVisible();
});

test('ученик проходит свой кабинет', async ({ page }) => {
  await login(page, 'student');
  for (const path of [
    '/dashboard/student',
    '/dashboard/student/calendar',
    '/dashboard/student/bookings',
    '/dashboard/student/lessons',
    '/dashboard/student/teacher',
    '/dashboard/student/notifications',
    '/dashboard/student/profile',
  ]) {
    await expectHealthy(page, path);
  }
  await expect(page.getByText('student@tutor.local').first()).toBeVisible();
});

test('преподаватель создаёт слот, ученик записывается', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, 'teacher');
  await expectHealthy(page, '/dashboard/teacher');
  await expectHealthy(page, '/dashboard/teacher/students');
  await expectHealthy(page, '/dashboard/teacher/lessons');
  await expectHealthy(page, '/dashboard/teacher/notifications');
  await expectHealthy(page, '/dashboard/teacher/profile');

  await page.goto('/dashboard/teacher/calendar');
  await page.getByRole('button', { name: 'Новый слот' }).click();
  await page.getByRole('button', { name: /Вс/ }).click();
  const freeTime = page
    .locator('button:not([disabled])')
    .filter({ hasText: /^\d{2}:\d{2}$/ })
    .last();
  await expect(freeTime).toBeVisible();
  const timeLabel = (await freeTime.innerText()).trim();
  await freeTime.click();
  await page.getByPlaceholder('Тема или комментарий…').fill('Проверка сервиса');
  await page.getByRole('button', { name: 'Создать слот' }).click();
  await expect(page.getByText('Слот создан')).toBeVisible();

  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.waitForURL('/');

  await login(page, 'student');
  await page.goto('/dashboard/student/calendar');
  await page.getByRole('button', { name: 'Записаться', exact: true }).click();
  await page.getByText('Свободно').last().click();
  await expect(page.getByText('Проверка сервиса')).toBeVisible();
  await page.getByRole('button', { name: 'Записаться', exact: true }).click();
  await expect(page.getByText('Запись подтверждена')).toBeVisible();

  await page.goto('/dashboard/student/bookings');
  await expect(page.getByText(timeLabel).or(page.getByText('Подтверждено')).first()).toBeVisible();
});

test('администратор открывает разделы и создаёт код', async ({ page }) => {
  await login(page, 'admin');
  for (const path of [
    '/dashboard/admin',
    '/dashboard/admin/users',
    '/dashboard/admin/teachers',
    '/dashboard/admin/codes',
    '/dashboard/admin/calendar',
    '/dashboard/admin/notifications',
  ]) {
    await expectHealthy(page, path);
  }
  await page.goto('/dashboard/admin/codes');
  await page.getByRole('button', { name: /Создать|код/i }).click();
  await expect(page.getByText('Код создан')).toBeVisible();
});

test('видеоурок преподавателя не ловит 401 и 409', async ({ page }) => {
  const failures: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/rtc/validate') && response.status() === 401) {
      failures.push(`validate ${response.status()}`);
    }
    if (/\/board(\?|$)/.test(url) && response.status() === 409) {
      failures.push(`board ${response.status()}`);
    }
    if (url.includes('/api/') && response.status() >= 500) {
      failures.push(`${response.status()} ${url}`);
    }
  });

  await login(page, 'teacher');
  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  const start = new Date(Date.now() + 5 * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const created = await page.request.post('http://localhost:3001/api/calendar/slots', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      lessonType: 'individual',
      capacity: 1,
      note: 'Проверка видео',
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const slot = (await created.json()) as { id: string };
  await page.goto(`/dashboard/teacher/lesson/${slot.id}?view=video`);
  await expect(page.getByText('Ведение урока')).toBeVisible();
  await page.waitForTimeout(6000);
  expect(failures, failures.join(', ')).toEqual([]);
});
