// src/lib/groq.ts
// BrotherFit — AI Smart Reply with Groq (Free, no card required)
// Bengali + English mix support, dynamic Firestore context

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_MODEL   = 'llama-3.3-70b-versatile'; // strong Bengali + reasoning support
const GROQ_URL      = 'https://api.groq.com/openai/v1/chat/completions';

const BRAND_PERSONALITY = `তুমি BrotherFit এর AI customer assistant।

## ভাষার নিয়ম (CRITICAL)
- সবসময় বাংলায় উত্তর দাও, ইংরেজি product/brand নাম ছাড়া
- বাংলা লেখা অবশ্যই বাংলা script এ লিখবে (বাংলিশ/Banglish নয়)
- কাস্টমার ইংরেজিতে লিখলেও তুমি বাংলায় reply দেবে, যদি না সে স্পষ্টভাবে ইংরেজি চায়
- Numbers বাংলা সংখ্যায় লিখবে (৫০০, ১২০০) টাকার ক্ষেত্রে

## কথা বলার নিয়ম
1. সংক্ষিপ্ত রাখো — সর্বোচ্চ ৫-৬ লাইন
2. Emoji ব্যবহার করো (২-৪টা) — বেশি না
3. কাস্টমারকে "ভাই/আপু" বলে সম্বোধন করো
4. Product এর stock শেষ হলে সততার সাথে জানাও
5. না জানা বিষয়ে "একটু confirm করে জানাচ্ছি" বলো
6. কখনো ভুল price বা info দিও না
7. ৮ লাইনের বেশি লিখবে না

## তোমাকে যা দেওয়া হবে
- BROTHERFIT STORE LIVE DATA — Firestore থেকে real-time data
- এই data দিয়েই কাস্টমারের প্রশ্নের উত্তর দাও
- Price, stock, size সব data থেকে নাও, নিজে থেকে অনুমান করো না`;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GroqResponse {
  reply: string;
  tokens: { input: number; output: number };
}

// ── Core API call (OpenAI-compatible format) ────────────────────────────────────
async function callGroq(
  systemInstruction: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<GroqResponse> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      messages:    [{ role: 'system', content: systemInstruction }, ...messages],
      temperature: 0.75,
      max_tokens:  500,
      top_p:       0.9,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq error: ${JSON.stringify(err)}`);
  }

  const data  = await res.json();
  const reply = data.choices?.[0]?.message?.content ?? '';

  return {
    reply: reply.trim(),
    tokens: {
      input:  data.usage?.prompt_tokens     ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
  };
}

// ── Main: Smart reply with Firestore context (Bengali-first) ───────────────────
export async function generateSmartReply(
  userMessage:  string,
  storeContext: string,
  history:      ChatMessage[] = []
): Promise<GroqResponse> {

  const systemPrompt = `${BRAND_PERSONALITY}\n\n${storeContext}`;

  // ChatMessage role 'model' → OpenAI format 'assistant'
  const messages = [
    ...history.slice(-8).map(m => ({
      role:    (m.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  return callGroq(systemPrompt, messages);
}

// ── Abandoned cart reminder (Bengali) ───────────────────────────────────────────
export async function generateCartReminder(cart: {
  customerName: string;
  items: { name: string; size: string; qty: number; price: number }[];
  totalAmount: number;
}): Promise<string> {
  const itemList = cart.items
    .map(i => `• ${i.name} (${i.size}) × ${i.qty} = ৳${i.price * i.qty}`)
    .join('\n');

  const prompt =
    `BrotherFit এর হয়ে সম্পূর্ণ বাংলায় একটা friendly WhatsApp cart reminder লেখো।\n\n` +
    `Customer: ${cart.customerName}\nCart:\n${itemList}\nTotal: ৳${cart.totalAmount}\n\n` +
    `নিয়ম: warm tone, ৫ লাইনের মধ্যে, brotherfit.com/cart link দাও, ২-৩টা emoji, সম্পূর্ণ বাংলায়`;

  const res = await callGroq(BRAND_PERSONALITY, [{ role: 'user', content: prompt }]);
  return res.reply;
}

// ── Intent classifier ────────────────────────────────────────────────────────────
export async function classifyIntent(message: string): Promise<string> {
  const prompt =
    `এই কাস্টমার মেসেজটি classify করো একটা category তে।\n` +
    `Message: "${message}"\n` +
    `Categories: product_inquiry, price, size, order_status, payment, return, greeting, complaint, other\n` +
    `শুধু category নামটা লিখো, আর কিছু না।`;

  const res = await callGroq(
    'You are a classifier. Return only the category name in English, nothing else.',
    [{ role: 'user', content: prompt }]
  );
  return res.reply.toLowerCase().trim();
}
