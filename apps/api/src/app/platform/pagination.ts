import { BadRequestException } from '@nestjs/common';

/**
 * Keyset (cursor) pagination: the next page starts after the last row's (sort value, id), so a page costs the
 * same at row 10 or row 10 million, unlike OFFSET. Cursors are opaque base64 strings to clients.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export const limitFrom = (raw: unknown): number => {
  const n = Number(raw ?? DEFAULT_LIMIT);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_LIMIT) : DEFAULT_LIMIT;
};

export interface Cursor {
  /** The sort column's value of the last row (ISO date, number or string). */
  v: string | number | null;
  id: string;
}

export const encodeCursor = (cursor: Cursor): string => Buffer.from(JSON.stringify(cursor)).toString('base64url');

export const decodeCursor = (raw: unknown): Cursor | null => {
  if (raw === undefined || raw === null || raw === '') return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8')) as Cursor;
    if (typeof parsed.id !== 'string') throw new Error();
    return parsed;
  } catch {
    throw new BadRequestException('That page link is no longer valid. Reload the list.');
  }
};

/** Takes `limit + 1` rows (the extra one only says whether there is a next page) and builds the page. */
export function toPage<T extends { id: string }>(rows: T[], limit: number, sortValue: (row: T) => Cursor['v']): Page<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last ? encodeCursor({ v: sortValue(last), id: last.id }) : null };
}
