import { rangesOverlap, assertValidSlotRange } from './slot-overlap';

describe('slot-overlap', () => {
  it('detects overlapping ranges', () => {
    const aStart = new Date('2026-01-01T10:00:00Z');
    const aEnd = new Date('2026-01-01T11:00:00Z');
    const bStart = new Date('2026-01-01T10:30:00Z');
    const bEnd = new Date('2026-01-01T11:30:00Z');
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  it('allows adjacent ranges', () => {
    const aStart = new Date('2026-01-01T10:00:00Z');
    const aEnd = new Date('2026-01-01T11:00:00Z');
    const bStart = new Date('2026-01-01T11:00:00Z');
    const bEnd = new Date('2026-01-01T12:00:00Z');
    expect(rangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(false);
  });

  it('rejects inverted ranges', () => {
    expect(() =>
      assertValidSlotRange(
        new Date('2026-01-01T11:00:00Z'),
        new Date('2026-01-01T10:00:00Z'),
      ),
    ).toThrow('раньше');
  });
});
