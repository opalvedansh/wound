import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor, limitFrom, toPage } from './pagination';

describe('pagination', () => {
  it('clamps the page size', () => {
    expect(limitFrom(undefined)).toBe(25);
    expect(limitFrom('10')).toBe(10);
    expect(limitFrom('500')).toBe(100);
    expect(limitFrom('-3')).toBe(25);
    expect(limitFrom('abc')).toBe(25);
  });

  it('round-trips a cursor and refuses a tampered one', () => {
    const cursor = { v: '2026-10-08T10:00:00.000Z', id: 'p1' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor('')).toBeNull();
    expect(() => decodeCursor('not-a-cursor')).toThrow(BadRequestException);
  });

  it('uses the extra row only to say there is a next page', () => {
    const rows = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'c', n: 3 }];
    const page = toPage(rows, 2, (r) => r.n);
    expect(page.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(decodeCursor(page.nextCursor)).toEqual({ v: 2, id: 'b' });
    expect(toPage(rows, 3, (r) => r.n).nextCursor).toBeNull();
  });
});
