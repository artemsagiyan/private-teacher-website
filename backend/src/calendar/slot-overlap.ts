export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
) {
  return aStart < bEnd && aEnd > bStart;
}

export function assertValidSlotRange(start: Date, end: Date) {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    throw new Error('Некорректное время начала');
  }
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    throw new Error('Некорректное время окончания');
  }
  if (start >= end) {
    throw new Error('Время начала должно быть раньше окончания');
  }
}
