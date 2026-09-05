import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LESSON_JOIN_EARLY_MS,
  LESSON_JOIN_LATE_MS,
  canJoinLesson,
  isUpcomingOrLive,
  parseLessonViewMode,
} from '../frontend/src/lib/lesson.ts';

const HOUR = 3_600_000;

describe('canJoinLesson', () => {
  const start = Date.parse('2026-09-05T12:00:00.000Z');
  const end = start + HOUR;

  it('opens 30 minutes before start', () => {
    assert.equal(canJoinLesson(start, end, start - LESSON_JOIN_EARLY_MS), true);
    assert.equal(
      canJoinLesson(start, end, start - LESSON_JOIN_EARLY_MS - 1),
      false,
    );
  });

  it('stays open after the lesson starts', () => {
    assert.equal(canJoinLesson(start, end, start + 1), true);
  });

  it('closes after the late join window', () => {
    assert.equal(canJoinLesson(start, end, end + LESSON_JOIN_LATE_MS), true);
    assert.equal(
      canJoinLesson(start, end, end + LESSON_JOIN_LATE_MS + 1),
      false,
    );
  });
});

describe('isUpcomingOrLive', () => {
  const start = Date.parse('2026-09-05T12:00:00.000Z');
  const end = start + HOUR;

  it('keeps an in-progress lesson in the upcoming list', () => {
    assert.equal(isUpcomingOrLive(start, end, start + 5 * 60_000), true);
  });

  it('drops a lesson after the late join window', () => {
    assert.equal(
      isUpcomingOrLive(start, end, end + LESSON_JOIN_LATE_MS + 1),
      false,
    );
  });
});

describe('parseLessonViewMode', () => {
  it('maps view query to room mode', () => {
    assert.equal(parseLessonViewMode('board'), 'board');
    assert.equal(parseLessonViewMode('video'), 'video');
    assert.equal(parseLessonViewMode('nope'), 'split');
    assert.equal(parseLessonViewMode(null), 'split');
  });
});
