import { NextResponse } from 'next/server';

// Question catalog editing is disabled for the pilot: the catalog is seeded by migration.
const disabled = () =>
  NextResponse.json({ error: 'Question catalog editing is disabled' }, { status: 403 });

export const PUT = disabled;
export const DELETE = disabled;
