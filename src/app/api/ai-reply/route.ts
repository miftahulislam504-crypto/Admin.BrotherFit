// src/app/api/ai-reply/route.ts
// BrotherFit Admin — AI Smart Reply Endpoint (Groq + Firestore context)

import { NextRequest, NextResponse } from 'next/server';
import { generateSmartReply, classifyIntent, type ChatMessage } from '@/lib/groq';
import { buildContext } from '@/lib/contextBuilder';
import { getMessages, saveMessage, getContact } from '@/services/automationService';
import { MetaAPI } from '@/lib/meta-api';

export async function POST(req: NextRequest) {
  try {
    const { contactId, message, autoSend = false } = await req.json();

    if (!contactId || !message) {
      return NextResponse.json({ error: 'contactId and message required' }, { status: 400 });
    }

    // 1. Load contact
    const contact = await getContact(contactId);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // 2. Load conversation history
    const history = await getMessages(contactId, 10);
    const chatHistory: ChatMessage[] = history.map(m => ({
      role:    m.direction === 'inbound' ? 'user' as const : 'model' as const,
      content: m.content,
    }));

    // 3. Build live Firestore context (products, settings, orders)
    const storeContext = await buildContext(message, contact.phone);

    // 4. Classify intent
    const intent = await classifyIntent(message).catch(() => 'other');

    // 5. Generate AI reply (Bengali-first, via Groq)
    const { reply, tokens } = await generateSmartReply(message, storeContext, chatHistory);

    if (!reply) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    // 6. Auto-send if requested
    if (autoSend) {
      const platformId = contact.facebookId ?? contact.instagramId ?? contact.whatsappId;
      if (platformId) {
        await MetaAPI.send(contact.platform, platformId, reply);
        await saveMessage({
          contactId,
          platform:  contact.platform,
          direction: 'outbound',
          content:   reply,
        });
      }
    }

    return NextResponse.json({ reply, intent, tokens });

  } catch (err: any) {
    console.error('[AI Reply]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
