// src/app/api/ai-reply/route.ts
// BrotherFit Admin — AI Smart Reply Endpoint

import { NextRequest, NextResponse } from 'next/server';
import { generateReply, classifyIntent } from '@/lib/gemini';
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

    // 2. Load recent conversation history (last 10 messages)
    const history = await getMessages(contactId, 10);
    const chatHistory = history.map(m => ({
      role: m.direction === 'inbound' ? 'user' as const : 'model' as const,
      content: m.content,
    }));

    // 3. Classify intent (for logging/analytics)
    const intent = await classifyIntent(message).catch(() => 'other');

    // 4. Generate AI reply
    const { reply, inputTokens, outputTokens } = await generateReply(message, '', chatHistory);

    if (!reply) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    // 5. Auto-send if requested (from webhook flow)
    if (autoSend) {
      const platformId = contact.facebookId ?? contact.instagramId ?? contact.whatsappId;
      if (platformId) {
        await MetaAPI.send(contact.platform, platformId, reply);
        await saveMessage({
          contactId, platform: contact.platform,
          direction: 'outbound', content: reply,
        });
      }
    }

    return NextResponse.json({
      reply,
      intent,
      tokens: { input: inputTokens, output: outputTokens },
    });

  } catch (err: any) {
    console.error('[AI Reply]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
