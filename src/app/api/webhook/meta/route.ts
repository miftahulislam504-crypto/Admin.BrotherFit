// src/app/api/webhook/meta/route.ts
// BrotherFit Admin — Meta Webhook Receiver

import { NextRequest, NextResponse } from 'next/server';
import { processIncoming } from '@/services/automationService';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;

// ── GET: Meta Webhook Verification ───────────────────────
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode      = p.get('hub.mode');
  const token     = p.get('hub.verify_token');
  const challenge = p.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verified');
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── POST: Receive Events ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Facebook Messenger
    if (body.object === 'page') {
      for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
          if (ev.message?.text && !ev.message.is_echo) {
            await processIncoming({
              senderId: ev.sender.id, content: ev.message.text,
              platform: 'facebook', platformMessageId: ev.message.mid,
            });
          }
        }
      }
    }

    // Instagram
    if (body.object === 'instagram') {
      for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
          if (ev.message?.text && !ev.message.is_echo) {
            await processIncoming({
              senderId: ev.sender.id, content: ev.message.text,
              platform: 'instagram', platformMessageId: ev.message.mid,
            });
          }
        }
      }
    }

    // WhatsApp
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== 'messages') continue;
          const msgs     = change.value?.messages ?? [];
          const contacts = change.value?.contacts ?? [];
          for (const msg of msgs) {
            if (msg.type === 'text') {
              const name = contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name;
              await processIncoming({
                senderId: msg.from, content: msg.text.body,
                platform: 'whatsapp', platformMessageId: msg.id, senderName: name,
              });
            }
          }
        }
      }
    }

    // Always return 200 — Meta retries otherwise
    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Webhook] Error:', err.message);
    return NextResponse.json({ status: 'ok' }); // still 200
  }
}
