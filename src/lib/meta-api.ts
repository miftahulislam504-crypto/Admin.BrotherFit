// src/lib/meta-api.ts
// BrotherFit Admin — Meta API Helper (Facebook, Instagram, WhatsApp)

const GRAPH_VERSION = 'v23.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graphPost(path: string, body: object, token: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

export class MetaAPI {
  // ── Facebook Messenger ───────────────────────────────────
  static async sendFacebook(recipientId: string, text: string) {
    const token = process.env.META_PAGE_ACCESS_TOKEN!;
    return graphPost(
      `/me/messages?access_token=${token}`,
      { recipient: { id: recipientId }, message: { text }, messaging_type: 'RESPONSE' },
      token
    ).catch(e => { console.error('[MetaAPI FB]', e); return null; });
  }

  // ── Instagram DM ─────────────────────────────────────────
  static async sendInstagram(recipientId: string, text: string) {
    const token = process.env.META_PAGE_ACCESS_TOKEN!;
    return graphPost(
      `/me/messages?access_token=${token}`,
      { recipient: { id: recipientId }, message: { text } },
      token
    ).catch(e => { console.error('[MetaAPI IG]', e); return null; });
  }

  // ── WhatsApp Cloud API ───────────────────────────────────
  static async sendWhatsApp(phone: string, text: string) {
    const token   = process.env.META_WHATSAPP_TOKEN!;
    const phoneId = process.env.META_WHATSAPP_PHONE_ID!;
    return graphPost(
      `/${phoneId}/messages`,
      { messaging_product: 'whatsapp', recipient_type: 'individual', to: phone,
        type: 'text', text: { preview_url: false, body: text } },
      token
    ).catch(e => { console.error('[MetaAPI WA]', e); return null; });
  }

  // ── WhatsApp Template ────────────────────────────────────
  static async sendWhatsAppTemplate(phone: string, templateName: string, params: string[] = []) {
    const token   = process.env.META_WHATSAPP_TOKEN!;
    const phoneId = process.env.META_WHATSAPP_PHONE_ID!;
    return graphPost(
      `/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp', to: phone, type: 'template',
        template: {
          name: templateName, language: { code: 'en' },
          components: params.length ? [{
            type: 'body',
            parameters: params.map(p => ({ type: 'text', text: p })),
          }] : [],
        },
      },
      token
    ).catch(e => { console.error('[MetaAPI WA Template]', e); return null; });
  }

  // ── Unified send ─────────────────────────────────────────
  static async send(platform: string, recipientId: string, text: string) {
    switch (platform) {
      case 'facebook':  return this.sendFacebook(recipientId, text);
      case 'instagram': return this.sendInstagram(recipientId, text);
      case 'whatsapp':  return this.sendWhatsApp(recipientId, text);
      default: console.warn('[MetaAPI] Unknown platform:', platform); return null;
    }
  }

  // ── WhatsApp Broadcast (multiple recipients) ─────────────
  static async broadcast(phones: string[], text: string) {
    const results = await Promise.allSettled(
      phones.map(p => this.sendWhatsApp(p, text))
    );
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed  = results.filter(r => r.status === 'rejected').length;
    return { success, failed, total: phones.length };
  }
}
