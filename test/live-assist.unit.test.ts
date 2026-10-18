import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function chooseTopic(topics: Array<{ id: string; title: string }>, context: string) {
  const normalized = context.toLocaleLowerCase('ru-RU');
  return topics.find((topic) => normalized.includes(topic.title.toLocaleLowerCase('ru-RU'))) || topics[0] || null;
}

describe('live assistant topic selection', () => {
  it('matches an explicitly mentioned topic', () => {
    const topic = chooseTopic([{ id: '1', title: 'Квадратные уравнения' }, { id: '2', title: 'Функции' }], 'разберём квадратные уравнения');
    assert.equal(topic?.id, '1');
  });

  it('falls back to the first curriculum topic with no transcript text', () => {
    const topic = chooseTopic([{ id: '1', title: 'Квадратные уравнения' }], '');
    assert.equal(topic?.id, '1');
  });

  it('returns no topic for an empty curriculum', () => {
    assert.equal(chooseTopic([], 'дискриминант'), null);
  });
});
