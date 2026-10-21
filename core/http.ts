import { NextResponse } from 'next/server';
import { AppError, STATUS_BY_KIND } from './errors.ts';

// Interface-layer helper: translates application errors into JSON responses; unknown errors become a generic 500.
export function errorResponse(e: unknown, context: string): NextResponse {
  if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: STATUS_BY_KIND[e.kind] });
  console.error(`${context} failed`, e);
  return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
}
