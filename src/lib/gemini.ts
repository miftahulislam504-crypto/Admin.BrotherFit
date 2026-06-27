// src/lib/gemini.ts
// BrotherFit Admin — Google Gemini AI Client

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL   = 'gemini-2.0-flash';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── BrotherFit Brand System Prompt ────────────────────────────────────────────
const BROTHERFIT_SYSTEM_PROMPT = `তুমি BrotherFit এর customer support assistant। BrotherFit একটি Bangladeshi streetwear brand।

## Brand Info
- নাম: BrotherFit
- ধরন: Bangladeshi Streetwear / Urban Fashion
- মূল্যবোধ: Quality, Authenticity, Islamic values, Community
- ভাষা: Bengali + English mix (casual, friendly tone)
- Website: brotherfit.com

## Products & Pricing
| Product            | Price        |
|--------------------|-------------|
| Oversized T-Shirt  | ৳৩৯৯–৫৯৯   |
| Joggers            | ৳৬৯৯–৮৯৯   |
| Cap                | ৳২৯৯       |
| Socks (3 pack)     | ৳১৯৯       |
| Bundle (T+Jogger)  | ৳৯৯৯ (Save ৳১০০) |

## Size Guide
| Size | Chest | Best for Height |
|------|-------|-----------------|
| S    | 36"   | 5'4"–5'7"      |
| M    | 38"   | 5'5"–5'8"      |
| L    | 40"   | 5'7"–5'10"     |
| XL   | 42"   | 5'8"–5'11"     |
| XXL  | 44"   | 5'10"+         |

## Delivery
- Dhaka: 1–2 business days (৳70)
- Outside Dhaka: 2–4 business days (৳120)
- Free delivery on orders ৳1500+
- Cash on Delivery (COD) available সারা বাংলাদেশ

## Payment Methods
- বিকাশ, নগদ, রকেট
- Cash on Delivery (COD)
- Card payment (website)

## Return/Exchange Policy
- 7 দিনের মধ্যে exchange করা যাবে (size issue)
- Product অবশ্যই unused ও original packaging এ থাকতে হবে
- Exchange hotline: 01XXXXXXXXX

## Tone & Style Rules
1. সবসময় friendly, warm, respectful tone রাখো
2. Bengali + English mix করো (like a young Bangladeshi would)
3. Emoji use করো কিন্তু বেশি না (2–4 per message)
4. Islamic greetings/phrases ব্যবহার করতে পারো স্বাভাবিকভাবে
5. সংক্ষিপ্ত রাখো — 3–5 lines ideal
6. Order নিতে সাহায্য করো, website এ guide করো
7. জানো না এমন কিছু হলে "আমি একটু check করে জানাচ্ছি" বলো
8. কখনো competitor এর নাম নিও না বা তুলনা করো না

## What NOT to do
- কখনো ভুল price বা policy দিও না
- Personal information (address, phone) share করো না
- Negative বা dismissive হয়ো না
- একই sentence বারবার repeat করো না`;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiResponse {
  reply: string;
  inputTokens: number;
  outputTokens: number;
}

// ── Core API call ──────────────────────────────────────────────────────────────
async function callGemini(contents: object[]): Promise<GeminiResponse> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: BROTHERFIT_SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature:     0.7,
        maxOutputTokens: 300,
        topP:            0.9,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const reply        = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const inputTokens  = data.usageMetadata?.promptTokenCount     ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

  return { reply: reply.trim(), inputTokens, outputTokens };
}

// ── Single message reply ───────────────────────────────────────────────────────
export async function generateReply(
  userMessage: string,
  history: ChatMessage[] = []
): Promise<GeminiResponse> {
  const contents = [
    // conversation history
    ...history.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    // new user message
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  return callGemini(contents);
}

// ── Abandoned cart reminder message ───────────────────────────────────────────
export async function generateCartReminder(cartInfo: {
  customerName: string;
  items: { name: string; size: string; qty: number; price: number }[];
  totalAmount: number;
}): Promise<string> {
  const itemList = cartInfo.items
    .map(i => `• ${i.name} (${i.size}) × ${i.qty} = ৳${i.price * i.qty}`)
    .join('\n');

  const prompt =
    `Generate a friendly WhatsApp cart abandonment reminder in Bengali+English mix for BrotherFit.\n\n` +
    `Customer Name: ${cartInfo.customerName}\n` +
    `Cart Items:\n${itemList}\n` +
    `Total: ৳${cartInfo.totalAmount}\n\n` +
    `Rules:\n` +
    `- Warm, friendly tone\n` +
    `- Mention items briefly\n` +
    `- Include brotherfit.com/cart link\n` +
    `- Keep under 100 words\n` +
    `- Use 2–3 relevant emojis\n` +
    `- End with a gentle call-to-action`;

  const res = await callGemini([{ role: 'user', parts: [{ text: prompt }] }]);
  return res.reply;
}

// ── Classify message intent (for smart routing) ────────────────────────────────
export async function classifyIntent(message: string): Promise<{
  intent: 'price'|'size'|'order'|'payment'|'return'|'complaint'|'greeting'|'other';
  confidence: number;
}> {
  const prompt =
    `Classify this customer message intent for a clothing brand.\n` +
    `Message: "${message}"\n\n` +
    `Return ONLY valid JSON (no markdown): {"intent": "price|size|order|payment|return|complaint|greeting|other", "confidence": 0.0-1.0}`;

  const res = await callGemini([{ role: 'user', parts: [{ text: prompt }] }]);

  try {
    const clean = res.reply.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { intent: 'other', confidence: 0.5 };
  }
}
