// src/app/api/webhook/meta/route.ts
// BrotherFit — AI-First Webhook (No manual rules needed)

import { NextRequest, NextResponse } from 'next/server';
import { generateSmartReply, classifyIntent, type ChatMessage } from '@/lib/groq';
import { buildContext } from '@/lib/contextBuilder';
import { MetaAPI } from '@/lib/meta-api';
import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!;

// ── GET: Webhook Verification ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const p         = req.nextUrl.searchParams;
  const mode      = p.get('hub.mode');
  const token     = p.get('hub.verify_token');
  const challenge = p.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Verified');
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── POST: Receive Events ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Facebook Messenger
    if (body.object === 'page') {
      for (const entry of body.entry ?? []) {
        for (const ev of entry.messaging ?? []) {
          if (ev.message?.text && !ev.message.is_echo) {
            await handleMessage({
              senderId:  ev.sender.id,
              content:   ev.message.text,
              platform:  'facebook',
              msgId:     ev.message.mid,
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
            await handleMessage({
              senderId:  ev.sender.id,
              content:   ev.message.text,
              platform:  'instagram',
              msgId:     ev.message.mid,
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
              const name  = contacts.find((c: any) => c.wa_id === msg.from)?.profile?.name;
              await handleMessage({
                senderId:    msg.from,
                content:     msg.text.body,
                platform:    'whatsapp',
                msgId:       msg.id,
                senderName:  name,
                phone:       msg.from,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Webhook] Error:', err.message);
    return NextResponse.json({ status: 'ok' }); // always 200
  }
}

// ── Core message handler ──────────────────────────────────────────────────────
async function handleMessage(event: {
  senderId:   string;
  content:    string;
  platform:   string;
  msgId?:     string;
  senderName?: string;
  phone?:     string;
}) {
  console.log(`[AI] ${event.platform} message: "${event.content}"`);

  // 1. Find or create contact
  const contact = await findOrCreateContact(event);

  // 2. Save inbound message
  await saveMessage({
    contactId: contact.id,
    platform:  event.platform,
    direction: 'inbound',
    content:   event.content,
    msgId:     event.msgId,
  });

  // 3. Update unread count
  await updateDoc(doc(db, 'automation_contacts', contact.id), {
    lastMessage:    event.content.substring(0, 80),
    lastMessageAt:  serverTimestamp(),
    unreadCount:    (contact.unreadCount ?? 0) + 1,
  });

  // 4. Get conversation history for context
  const history = await getHistory(contact.id);

  // 5. Build Firestore context (products, settings, orders)
  const storeContext = await buildContext(event.content, contact.phone);

  // 6. Generate AI reply
  const { reply } = await generateSmartReply(event.content, storeContext, history);

  if (!reply) {
    console.warn('[AI] Empty reply from Gemini');
    return;
  }

  // 7. Send reply
  await MetaAPI.send(event.platform, event.senderId, reply);

  // 8. Save outbound message
  await saveMessage({
    contactId: contact.id,
    platform:  event.platform,
    direction: 'outbound',
    content:   reply,
  });

  // 9. Log intent (background, non-blocking)
  classifyIntent(event.content).then(intent => {
    addDoc(collection(db, 'automation_logs'), {
      contactId: contact.id,
      intent,
      message:   event.content,
      reply,
      platform:  event.platform,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  }).catch(() => {});
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function findOrCreateContact(event: {
  senderId: string; platform: string;
  senderName?: string; phone?: string;
}) {
  const field = event.platform === 'facebook' ? 'facebookId'
    : event.platform === 'instagram'          ? 'instagramId'
    : 'whatsappId';

  const snap = await getDocs(query(
    collection(db, 'automation_contacts'),
    where(field, '==', event.senderId), limit(1)
  ));

  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as any;
  }

  const ref = await addDoc(collection(db, 'automation_contacts'), {
    [field]:      event.senderId,
    name:         event.senderName ?? null,
    phone:        event.phone ?? null,
    platform:     event.platform,
    status:       'new',
    tags:         [],
    unreadCount:  0,
    lastMessage:  null,
    lastMessageAt:null,
    createdAt:    serverTimestamp(),
  });

  return { id: ref.id, unreadCount: 0, phone: event.phone ?? null };
}

async function getHistory(contactId: string): Promise<ChatMessage[]> {
  const snap = await getDocs(query(
    collection(db, 'automation_messages'),
    where('contactId', '==', contactId),
    orderBy('createdAt', 'asc'),
    limit(10)
  ));

  return snap.docs.map(d => ({
    role:    d.data().direction === 'inbound' ? 'user' as const : 'model' as const,
    content: d.data().content,
  }));
}

async function saveMessage(data: {
  contactId: string; platform: string;
  direction: string; content: string; msgId?: string;
}) {
  await addDoc(collection(db, 'automation_messages'), {
    contactId:         data.contactId,
    platform:          data.platform,
    direction:         data.direction,
    content:           data.content,
    platformMessageId: data.msgId ?? null,
    isRead:            data.direction === 'outbound',
    createdAt:         serverTimestamp(),
  });
}

