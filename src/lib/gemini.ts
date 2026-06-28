// src/lib/gemini.ts  (পুরোটা replace করো)
// BrotherFit — AI Smart Reply with Dynamic Firestore Context

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL   = 'gemini-2.0-flash';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const BRAND_PERSONALITY = `তুমি BrotherFit এর AI customer assistant।

## কথা বলার নিয়ম
1. সংক্ষিপ্ত রাখো — সর্বোচ্চ 5-6 লাইন
2. Emoji use করো (2-4 টা)
3. বাংলা + ইংরেজি mix এ কথা বলো
4. Customer কে "ভাই/আপু" বলে address করো
5. Product stock শেষ হলে সততার সাথে জানাও
6. জানো না এমন কিছু হলে "একটু confirm করে জানাচ্ছি" বলো
7. কখনো ভুল price বা info দিও না
8. 8 লাইনের বেশি লিখবে না

## তোমাকে যা দেওয়া হবে
- BROTHERFIT STORE LIVE DATA — Firestore থেকে real-time data
- এই data দিয়েই customer এর প্রশ্নের উত্তর দাও
- Price, stock, size সব data থেকে নাও`;

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiResponse {
  reply: string;
  tokens: { input: number; output: number };
}

async function callGemini(systemInstruction: string, contents: object[]): Promise<GeminiResponse> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.75, maxOutputTokens: 400, topP: 0.9 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    reply: (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim(),
    tokens: {
      input:  data.usageMetadata?.promptTokenCount     ?? 0,
      output: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

export async function generateSmartReply(
  userMessage:  string,
  storeContext: string,
  history:      ChatMessage[] = []
): Promise<GeminiResponse> {
  const systemPrompt = `${BRAND_PERSONALITY}\n\n${storeContext}`;
  const contents = [
    ...history.slice(-8).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  return callGemini(systemPrompt, contents);
}

export async function generateCartReminder(cart: {
  customerName: string;
  items: { name: string; size: string; qty: number; price: number }[];
  totalAmount: number;
}): Promise<string> {
  const itemList = cart.items
    .map(i => `• ${i.name} (${i.size}) × ${i.qty} = ৳${i.price * i.qty}`)
    .join('\n');

  const prompt =
    `BrotherFit এর হয়ে friendly WhatsApp cart reminder লেখো বাংলা+ইংরেজি mix এ।\n` +
    `Customer: ${cart.customerName}\nCart:\n${itemList}\nTotal: ৳${cart.totalAmount}\n` +
    `Rules: warm tone, 5 লাইনের মধ্যে, brotherfit.com/cart link দাও, 2-3 emoji`;

  const res = await callGemini(BRAND_PERSONALITY, [{ role: 'user', parts: [{ text: prompt }] }]);
  return res.reply;
}

export async function classifyIntent(message: string): Promise<string> {
  const prompt =
    `Classify: "${message}"\n` +
    `Categories: product_inquiry, price, size, order_status, payment, return, greeting, complaint, other\n` +
    `Return ONLY the category name.`;
  const res = await callGemini('Return only the category name.', [{ role: 'user', parts: [{ text: prompt }] }]);
  return res.reply.toLowerCase().trim();
}

