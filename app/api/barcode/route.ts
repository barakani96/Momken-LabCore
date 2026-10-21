import { authorizeApi } from '@/lib/auth/api-guard';
import { NextResponse } from 'next/server';
import * as bwipjs from 'bwip-js';

// Code 128 is suitable for accession identifiers. This endpoint encodes only a
// bounded label value and returns an SVG, not arbitrary user-provided markup.
export async function GET(request: Request) {
  const auth = await authorizeApi(false, 'specimens.read'); if ('response' in auth) return auth.response;
  const text = new URL(request.url).searchParams.get('text')?.trim() ?? '';
  if (!text || text.length > 40 || !/^[A-Za-z0-9-]+$/.test(text)) {
    return NextResponse.json({ error: 'A valid accession is required.' }, { status: 400 });
  }
  try {
    const svg = bwipjs.toSVG({ bcid: 'code128', text, scale: 2, height: 12, includetext: true, textxalign: 'center', padding: 2 });
    return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' } });
  } catch {
    return NextResponse.json({ error: 'Unable to render accession barcode.' }, { status: 400 });
  }
}
