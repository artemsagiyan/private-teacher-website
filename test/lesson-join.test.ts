import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canJoinLesson,
  isUpcomingOrLive,
  parseLessonViewMode,
} from '../frontend/src/lib/lesson.ts';

const HOUR = 3_600_000;

describe('canJoinLesson', () => {
  const start = Date.parse('2026-09-05T12:00:00.000Z');
  const end = start + HOUR;

  it('allows starting well before the scheduled time', () => {
    assert.equal(canJoinLesson(start, end, start - 24 * HOUR, 'waiting'), true);
  });

  it('stays open after the lesson starts', () => {
    assert.equal(canJoinLesson(start, end, start + 1), true);
  });

  it('keeps a waiting lesson available after its scheduled time', () => {
    assert.equal(canJoinLesson(start, end, end + 24 * HOUR, 'waiting'), true);
  });

  it('allows joining a slot before a lesson record exists', () => {
    assert.equal(canJoinLesson(start, end, end + 24 * HOUR), true);
  });

  it('hides the join link once the lesson is processing or completed', () => {
    assert.equal(canJoinLesson(start, end, Date.now(), 'processing'), false);
    assert.equal(canJoinLesson(start, end, Date.now(), 'completed'), false);
  });
});

describe('isUpcomingOrLive', () => {
  const start = Date.parse('2026-09-05T12:00:00.000Z');
  const end = start + HOUR;

  it('keeps an in-progress lesson in the upcoming list', () => {
    assert.equal(isUpcomingOrLive(start, end, start + 5 * 60_000), true);
  });

  it('keeps a waiting lesson visible after its scheduled time', () => {
    assert.equal(isUpcomingOrLive(start, end, end + 24 * HOUR, 'waiting'), true);
  });

  it('keeps a confirmed slot visible after its scheduled time', () => {
    assert.equal(isUpcomingOrLive(start, end, end + 24 * HOUR), true);
  });

  it('removes a completed lesson from the upcoming list', () => {
    assert.equal(isUpcomingOrLive(start, end, start, 'completed'), false);
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
