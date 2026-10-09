import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WB_PAYLOAD_MAX,
  changedElements,
  chunkBoardElements,
  elementSyncKey,
  fitElementForWire,
  isNewerElement,
} from '../frontend/src/lib/board-sync.ts';

describe('board sync deltas', () => {
  it('sends only elements that changed since the last packet', () => {
    const stroke = {
      id: 'a',
      type: 'freedraw',
      version: 2,
      points: [[0, 0], [1, 1]],
    };
    const sent = new Map([['a', elementSyncKey(stroke)]]);
    assert.deepEqual(changedElements([stroke], sent), []);

    const grown = { ...stroke, version: 3, points: [...stroke.points, [2, 2]] };
    assert.equal(changedElements([stroke, grown], sent).length, 1);
    assert.equal(changedElements([stroke, grown], sent)[0].id, 'a');
  });

  it('keeps a newer remote stroke and a fuller same-version stroke', () => {
    const local = { id: 'a', type: 'freedraw', version: 4, points: [[0, 0]] };
    assert.equal(
      isNewerElement({ ...local, version: 5, points: [[0, 0], [1, 1]] }, local),
      true,
    );
    assert.equal(
      isNewerElement({ ...local, points: [[0, 0], [1, 1], [2, 2]] }, local),
      true,
    );
    assert.equal(isNewerElement({ ...local, version: 3 }, local), false);
  });

  it('splits a scene into packets that fit the data channel', () => {
    const elements = Array.from({ length: 40 }, (_, index) => ({
      id: `e${index}`,
      type: 'freedraw',
      version: 1,
      points: Array.from({ length: 80 }, (_, point) => [point, index]),
    }));
    const chunks = chunkBoardElements(elements);
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      const bytes = new TextEncoder().encode(
        JSON.stringify({ elements: chunk, files: [] }),
      ).byteLength;
      assert.ok(bytes <= WB_PAYLOAD_MAX);
    }
    assert.equal(chunks.flat().length, elements.length);
  });

  it('thins a long stroke until one packet can carry it', () => {
    const stroke = {
      id: 'long',
      type: 'freedraw',
      version: 9,
      points: Array.from({ length: 4000 }, (_, index) => [index, index, 0.5]),
    };
    const fitted = fitElementForWire(stroke);
    assert.ok(fitted);
    assert.ok((fitted?.points?.length || 0) < stroke.points.length);
    assert.ok(
      new TextEncoder().encode(
        JSON.stringify({ elements: [fitted], files: [] }),
      ).byteLength <= WB_PAYLOAD_MAX,
    );
  });
});
