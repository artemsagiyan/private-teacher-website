/**
 * TutorPlatform API Test Suite
 * Запуск: node test/api.test.mjs
 * Требует: запущенный бэкенд на localhost:3001
 */

const BASE = 'http://localhost:3001/api';
const ADMIN    = { email: 'admin@tutor.local',   password: 'Admin12345'   };
const TEACHER  = { email: 'teacher@tutor.local', password: 'Teacher12345' };
const STUDENT  = { email: 'student@tutor.local', password: 'Student12345' };

let passed = 0, failed = 0;
const tokens = {};

// ─── helpers ────────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function test(name, fn) {
  return fn().then(() => {
    console.log(`  ✅ ${name}`);
    passed++;
  }).catch(err => {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  });
}

function expect(val) {
  return {
    toBe: (expected) => {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toBeOneOf: (...expected) => {
      if (!expected.includes(val)) throw new Error(`Expected one of ${expected.join('|')}, got ${val}`);
    },
    toExist: () => {
      if (val == null) throw new Error(`Expected value to exist, got ${val}`);
    },
    toContain: (key) => {
      if (!(key in val)) throw new Error(`Expected object to have key "${key}", got: ${JSON.stringify(Object.keys(val))}`);
    },
    toBeArray: () => {
      if (!Array.isArray(val)) throw new Error(`Expected array, got ${typeof val}`);
    },
  };
}

function section(name) {
  console.log(`\n── ${name} ${'─'.repeat(50 - name.length)}`);
}

// ─── test suites ─────────────────────────────────────────────────────────────

async function testAuth() {
  section('AUTH');

  await test('POST /auth/login — admin', async () => {
    const { status, data } = await req('POST', '/auth/login', ADMIN);
    expect(status).toBe(200);
    expect(data).toContain('accessToken');
    tokens.admin = data.accessToken;
    tokens.adminRefresh = data.refreshToken;
  });

  await test('POST /auth/login — teacher', async () => {
    const { status, data } = await req('POST', '/auth/login', TEACHER);
    expect(status).toBe(200);
    tokens.teacher = data.accessToken;
    tokens.teacherRefresh = data.refreshToken;
  });

  await test('POST /auth/login — student', async () => {
    const { status, data } = await req('POST', '/auth/login', STUDENT);
    expect(status).toBe(200);
    tokens.student = data.accessToken;
    tokens.studentRefresh = data.refreshToken;
  });

  await test('POST /auth/login — wrong password → 401', async () => {
    const { status } = await req('POST', '/auth/login', { email: ADMIN.email, password: 'WrongPass123' });
    expect(status).toBe(401);
  });

  await test('GET /auth/me — admin', async () => {
    const { status, data } = await req('GET', '/auth/me', null, tokens.admin);
    expect(status).toBe(200);
    expect(data.role).toBe('admin');
  });

  await test('GET /auth/me — no token → 401', async () => {
    const { status } = await req('GET', '/auth/me', null, null);
    expect(status).toBe(401);
  });

  await test('POST /auth/refresh — student', async () => {
    const { status, data } = await req('POST', '/auth/refresh',
      { refreshToken: tokens.studentRefresh }, tokens.student);
    expect(status).toBe(200);
    expect(data).toContain('accessToken');
    tokens.student = data.accessToken;
    tokens.studentRefresh = data.refreshToken;
  });

  await test('POST /auth/forgot-password', async () => {
    const { status } = await req('POST', '/auth/forgot-password', {
      email: STUDENT.email,
    });
    expect(status).toBe(200);
  });

  await test('POST /auth/register/student — новый аккаунт', async () => {
    const ts = Date.now();
    const { status, data } = await req('POST', '/auth/register/student', {
      firstName: 'Тест',
      lastName: 'Тестов',
      email: `test.${ts}@example.com`,
      password: 'Password12345',
      passwordConfirm: 'Password12345',
    });
    expect(status).toBe(201);
    expect(data).toContain('accessToken');
  });

  await test('POST /auth/register/student — дубль email → 409', async () => {
    const { status } = await req('POST', '/auth/register/student', {
      firstName: 'A', lastName: 'B',
      email: STUDENT.email,
      password: 'Password12345', passwordConfirm: 'Password12345',
    });
    expect(status).toBe(409);
  });

  await test('POST /auth/register/teacher — невалидный код → 400', async () => {
    const { status } = await req('POST', '/auth/register/teacher', {
      firstName: 'X', lastName: 'Y',
      email: `teacher.bad.${Date.now()}@example.com`,
      password: 'Password12345', passwordConfirm: 'Password12345',
      registrationCode: 'BADCODE000',
    });
    expect(status).toBe(400);
  });
}

async function testUsers() {
  section('USERS');

  await test('GET /users/me — student', async () => {
    const { status, data } = await req('GET', '/users/me', null, tokens.student);
    expect(status).toBe(200);
    expect(data.role).toBe('student');
  });

  await test('PATCH /users/profile — обновить имя', async () => {
    const { status, data } = await req('PATCH', '/users/profile',
      { firstName: 'Иван', lastName: 'Иванов' }, tokens.student);
    expect(status).toBe(200);
    expect(data.firstName).toBe('Иван');
  });

  await test('POST /users/change-password', async () => {
    const { status } = await req(
      'POST',
      '/users/change-password',
      { oldPassword: STUDENT.password, newPassword: STUDENT.password },
      tokens.student,
    );
    expect(status).toBeOneOf(200, 201);
  });
}

async function testTeachers() {
  section('TEACHERS');

  await test('GET /teachers/me — teacher', async () => {
    const { status, data } = await req('GET', '/teachers/me', null, tokens.teacher);
    expect(status).toBe(200);
    expect(data).toContain('userId');
  });

  await test('PATCH /teachers/profile — bio + subjects', async () => {
    const { status, data } = await req('PATCH', '/teachers/profile',
      { bio: 'Математика ЕГЭ', subjects: 'Математика, Физика' }, tokens.teacher);
    expect(status).toBe(200);
    expect(data.bio).toBe('Математика ЕГЭ');
  });

  await test('GET /teachers/students — список учеников', async () => {
    const { status, data } = await req('GET', '/teachers/students', null, tokens.teacher);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('POST /teachers/invite-code — генерация кода', async () => {
    const { status, data } = await req('POST', '/teachers/invite-code', null, tokens.teacher);
    expect(status).toBe(201);
    expect(data).toContain('inviteCode');
    tokens.inviteCode = data.inviteCode;
  });
}

async function testStudents() {
  section('STUDENTS');

  await test('GET /students/me — student', async () => {
    const { status, data } = await req('GET', '/students/me', null, tokens.student);
    expect(status).toBe(200);
    expect(data).toContain('userId');
  });

  await test('GET /students/teacher — мой преподаватель', async () => {
    const { status } = await req('GET', '/students/teacher', null, tokens.student);
    expect(status).toBeOneOf(200, 200); // null или объект — оба 200
  });

  await test('POST /students/attach-teacher — неверный код', async () => {
    const { status } = await req(
      'POST',
      '/students/attach-teacher',
      { inviteCode: 'NOPE' },
      tokens.student,
    );
    expect(status).toBeOneOf(400, 404);
  });
}

async function testCalendar() {
  section('CALENDAR');

  const start = new Date(Date.now() + 15 * 60 * 1000);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 45 * 60 * 1000);

  await test('POST /calendar/slots — создать слот', async () => {
    const existing = await req('GET', '/calendar/teacher', null, tokens.teacher);
    if (Array.isArray(existing.data)) {
      for (const slot of existing.data) {
        await req('DELETE', `/calendar/slots/${slot.id}`, null, tokens.teacher);
      }
    }

    let created = null;
    for (let offsetMin = 12; offsetMin <= 28 && !created; offsetMin += 4) {
      const s = new Date(Date.now() + offsetMin * 60 * 1000);
      s.setSeconds(0, 0);
      const e = new Date(s.getTime() + 25 * 60 * 1000);
      const { status, data } = await req('POST', '/calendar/slots', {
        startTime: s.toISOString(),
        endTime: e.toISOString(),
        lessonType: 'individual',
        capacity: 1,
      }, tokens.teacher);
      if (status === 201) created = data;
    }
    if (!created) throw new Error('не удалось создать свободный слот');
    expect(created).toContain('id');
    tokens.slotId = created.id;
  });

  await test('GET /calendar/teacher — слоты преподавателя', async () => {
    const { status, data } = await req('GET', '/calendar/teacher', null, tokens.teacher);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /calendar/student — слоты для ученика', async () => {
    const { status, data } = await req('GET', '/calendar/student', null, tokens.student);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('POST /calendar/slots — студент не может создать → 403', async () => {
    const { status } = await req('POST', '/calendar/slots', {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      lessonType: 'individual',
      capacity: 1,
    }, tokens.student);
    expect(status).toBe(403);
  });

  await test('PATCH /calendar/slots/:id — заметка', async () => {
    if (!tokens.slotId) throw new Error('slotId не получен');
    const { status } = await req(
      'PATCH',
      `/calendar/slots/${tokens.slotId}`,
      { note: 'тест' },
      tokens.teacher,
    );
    expect(status).toBe(200);
  });
}

async function testBookings() {
  section('BOOKINGS');

  await test('POST /bookings — записаться на слот', async () => {
    if (!tokens.slotId) throw new Error('slotId не получен на предыдущем шаге');
    const { status, data } = await req('POST', '/bookings',
      { slotId: tokens.slotId }, tokens.student);
    expect(status).toBe(201);
    tokens.bookingId = data.id;
  });

  await test('POST /bookings — повторная запись → 400', async () => {
    if (!tokens.slotId) throw new Error('slotId не получен');
    const { status } = await req('POST', '/bookings',
      { slotId: tokens.slotId }, tokens.student);
    expect(status).toBe(400);
  });

  await test('GET /bookings/my — история ученика', async () => {
    const { status, data } = await req('GET', '/bookings/my', null, tokens.student);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /bookings/upcoming — предстоящие', async () => {
    const { status, data } = await req('GET', '/bookings/upcoming', null, tokens.student);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /bookings/teacher — записи преподавателя', async () => {
    const { status, data } = await req('GET', '/bookings/teacher', null, tokens.teacher);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('DELETE /bookings/:id/student — меньше 24ч → 400', async () => {
    if (!tokens.bookingId) throw new Error('bookingId не получен');
    const { status } = await req(
      'DELETE',
      `/bookings/${tokens.bookingId}/student`,
      null,
      tokens.student,
    );
    expect(status).toBe(400);
  });
}

async function testNotifications() {
  section('NOTIFICATIONS');

  await test('GET /notifications — список', async () => {
    const { status, data } = await req('GET', '/notifications', null, tokens.student);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /notifications/unread-count', async () => {
    const { status, data } = await req('GET', '/notifications/unread-count', null, tokens.student);
    expect(status).toBe(200);
  });

  await test('PATCH /notifications/read-all', async () => {
    const { status } = await req('PATCH', '/notifications/read-all', null, tokens.student);
    expect(status).toBe(200);
  });
}

async function testLessons() {
  section('LESSONS');

  await test('GET /video/token — возвращает lessonId', async () => {
    const { status, data } = await req(
      'GET',
      `/video/token?slotId=${tokens.slotId}`,
      null,
      tokens.teacher,
    );
    expect(status).toBe(200);
    expect(data).toContain('lessonId');
    expect(data).toContain('lessonStatus');
    tokens.lessonId = data.lessonId;
  });

  await test('GET /lessons — история ученика', async () => {
    const { status, data } = await req('GET', '/lessons', null, tokens.student);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('PUT /lessons/:id/board — автосохранение доски', async () => {
    const { status } = await req(
      'PUT',
      `/lessons/${tokens.lessonId}/board`,
      { elements: [], appState: {}, files: {} },
      tokens.teacher,
    );
    expect(status).toBe(200);
  });

  await test('GET /lessons/:id/status', async () => {
    const { status, data } = await req(
      'GET',
      `/lessons/${tokens.lessonId}/status`,
      null,
      tokens.teacher,
    );
    expect(status).toBe(200);
    expect(data).toContain('status');
  });

  await test('POST /lessons/:id/end — ученик не может завершить → 403', async () => {
    const { status } = await req(
      'POST',
      `/lessons/${tokens.lessonId}/end`,
      null,
      tokens.student,
    );
    expect(status).toBe(403);
  });
}

async function testAdmin() {
  section('ADMIN');

  await test('GET /admin/stats', async () => {
    const { status, data } = await req('GET', '/admin/stats', null, tokens.admin);
    expect(status).toBe(200);
    expect(data).toContain('totalUsers');
  });

  await test('GET /admin/users', async () => {
    const { status, data } = await req('GET', '/admin/users', null, tokens.admin);
    expect(status).toBe(200);
    expect(data).toContain('users');
  });

  await test('GET /admin/users?search=admin — поиск', async () => {
    const { status, data } = await req('GET', '/admin/users?search=admin', null, tokens.admin);
    expect(status).toBe(200);
    expect(data.users).toBeArray();
  });

  await test('POST /admin/codes — сгенерировать код', async () => {
    const { status, data } = await req('POST', '/admin/codes',
      { expiresInDays: 7 }, tokens.admin);
    expect(status).toBe(201);
    expect(data).toContain('code');
  });

  await test('GET /admin/codes — список кодов', async () => {
    const { status, data } = await req('GET', '/admin/codes', null, tokens.admin);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /admin/teachers — список преподавателей', async () => {
    const { status, data } = await req('GET', '/admin/teachers', null, tokens.admin);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /admin/students — список учеников', async () => {
    const { status, data } = await req('GET', '/admin/students', null, tokens.admin);
    expect(status).toBe(200);
    expect(data).toBeArray();
  });

  await test('GET /admin/stats — студент → 403', async () => {
    const { status } = await req('GET', '/admin/stats', null, tokens.student);
    expect(status).toBe(403);
  });
}

// ─── run all ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         TutorPlatform API Test Suite                 ║');
  console.log(`║         ${BASE.padEnd(45)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  // проверяем доступность
  try {
    const ping = await fetch(`${BASE.replace(/\/api$/, '')}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    console.log(`\n🔌 Backend: ${ping.status === 200 ? 'доступен ✅' : `код ${ping.status}`}`);
  } catch {
    console.log('\n❌ Backend недоступен на http://localhost:3001');
    console.log('   Запусти: docker compose up -d\n');
    process.exit(1);
  }

  await testAuth();
  await testUsers();
  await testTeachers();
  await testStudents();
  await testCalendar();
  await testBookings();
  await testLessons();
  await testNotifications();
  await testAdmin();

  const total = passed + failed;
  console.log('\n' + '═'.repeat(54));
  console.log(`  Всего: ${total}   ✅ Прошло: ${passed}   ❌ Упало: ${failed}`);
  console.log('═'.repeat(54) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
