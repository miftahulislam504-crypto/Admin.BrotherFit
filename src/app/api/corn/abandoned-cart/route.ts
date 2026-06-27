// src/app/api/cron/abandoned-cart/route.ts
// BrotherFit Admin — Abandoned Cart Cron Job
//
// Vercel Cron: প্রতি ঘণ্টায় একবার চলবে
// vercel.json এ add করো:
// {
//   "crons": [{ "path": "/api/cron/abandoned-cart", "schedule": "0 * * * *" }]
// }

import { NextRequest, NextResponse } from 'next/server';
import { processAbandonedCarts } from '@/services/abandonedCartService';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Security: শুধু Vercel Cron অথবা সঠিক secret থেকে run হবে
  const authHeader = req.headers.get('authorization');
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting abandoned cart processing...');
  const start = Date.now();

  try {
    const result = await processAbandonedCarts();
    const elapsed = Date.now() - start;

    console.log(`[Cron] Done in ${elapsed}ms:`, result);

    return NextResponse.json({
      success:   true,
      elapsed:   `${elapsed}ms`,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error('[Cron] Abandoned cart error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Manual trigger (POST) — admin dashboard থেকে run করা যাবে
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return GET(req);
}
