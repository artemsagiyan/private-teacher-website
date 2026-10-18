import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

type Assist = { topic: { id: string; title: string } | null; confidence: number; suggestion: { task: string } | null };

async function request(base: string, token: string, lessonId: string, body: object) {
  const response = await fetch(`${base}/api/learning/lessons/${lessonId}/live-assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() as Assist };
}

describe('live lesson assistant contract', () => {
  it('returns a topic and task for board context', async () => {
    const base = process.env.API_BASE_URL || 'http://localhost:3001';
    const token = process.env.TEACHER_ACCESS_TOKEN;
    const lessonId = process.env.LIVE_ASSIST_LESSON_ID;
    if (!token || !lessonId) return;
    const result = await request(base, token, lessonId, { boardText: 'квадратное уравнение дискриминант' });
    assert.equal(result.status, 201);
    assert.ok(result.data.topic);
    assert.ok(result.data.suggestion?.task);
    assert.ok(result.data.confidence >= 0);
  });

  it('rejects unauthenticated requests', async () => {
    const base = process.env.API_BASE_URL || 'http://localhost:3001';
    const lessonId = process.env.LIVE_ASSIST_LESSON_ID || '00000000-0000-0000-0000-000000000000';
    const result = await request(base, '', lessonId, { boardText: 'тема' });
    assert.equal(result.status, 401);
  });
});
