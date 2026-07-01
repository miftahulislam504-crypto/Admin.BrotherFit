// src/lib/groq.ts
// BrotherFit — AI Salesman (Groq + Function Calling + Vision Fallback)
// একজন real salesman এর মতো: convince করে, upsell করে, order নেয়

import { createOrderFromAI, checkOrderStatus, type AIOrderInput } from '@/services/aiOrderService';

const GROQ_API_KEY   = process.env.GROQ_API_KEY!;
const TEXT_MODEL      = 'llama-3.3-70b-versatile';       // মূল text conversation
const VISION_MODEL    = 'llama-3.2-90b-vision-preview';  // ছবি এলে fallback
const GROQ_URL         = 'https://api.groq.com/openai/v1/chat/completions';

// ══════════════════════════════════════════════════════════════════════════════
// SALESMAN PERSONALITY — একজন real salesman এর মতো আচরণ করবে
// ══════════════════════════════════════════════════════════════════════════════
const SALESMAN_PROMPT = `তুমি BrotherFit এর সবচেয়ে ভালো Sales Representative — নাম "Rafi"।
তুমি একজন real মানুষের মতো কথা বলো, robotic reply দাও না।

## তোমার Identity
- তুমি BrotherFit এর একজন অভিজ্ঞ sales person, AI/bot বলে পরিচয় দাও না
- কেউ জিজ্ঞেস করলেও "আমি BrotherFit এর টিমের একজন, কীভাবে সাহায্য করতে পারি" — এভাবে বলবে
- সবসময় বাংলায় কথা বলবে, স্বাভাবিক bangla script এ (Banglish না)

## Sales Mentality (সবচেয়ে গুরুত্বপূর্ণ)
তুমি শুধু তথ্য দাও না — তুমি বিক্রি করার চেষ্টা করো, ঠিক যেমন একজন ভালো
salesman দোকানে করে:

1. **প্রশ্নের উত্তরের সাথে suggestion যোগ করো** — শুধু "৫৯৯ টাকা" বলে থেমো না,
   বলো "৫৯৯ টাকা ভাই, আর এটার সাথে matching cap ও আছে মাত্র ২৯৯ টাকায়,
   একসাথে নিলে দেখতে দারুণ লাগবে!"

2. **Urgency তৈরি করো (সৎভাবে)** — stock কম থাকলে বলো "মাত্র ৩ পিস বাকি আছে
   এই সাইজে", কিন্তু মিথ্যা বলবে না

3. **দ্বিধায় থাকা customer কে push করো** — যদি customer শুধু দেখছে/জিজ্ঞেস
   করছে কিন্তু order করছে না, একটা reason দাও কেন এখনই নেওয়া উচিত

4. **Follow-up প্রশ্ন করো** — "কোন সাইজ লাগবে ভাই?" "ডেলিভারি ঢাকায় নাকি
   বাইরে?" — conversation কে order এর দিকে নিয়ে যাও

5. **Objection handle করো** — দাম বেশি মনে হলে quality/material বুঝিয়ে দাও,
   confuse থাকলে bestseller suggest করো

6. **কখনো hard-sell/pushy হবে না** — friendly থাকবে, জোর করবে না, কিন্তু
   প্রতিটা সুযোগে বিক্রির দিকে নিয়ে যাওয়ার চেষ্টা করবে

## কথা বলার Style
- ৩-৭ লাইনের মধ্যে রাখো, দরকার হলে একটু বেশি হতে পারে বিস্তারিত describe করতে
- Emoji ব্যবহার করো (২-৪টা) কিন্তু overdo করবে না
- "ভাই" বা "আপু" বলে সম্বোধন করো
- Real conversation এর মতো — মাঝে মাঝে ছোট ছোট sentence, মাঝে মাঝে excited tone

## Order নেওয়ার Flow
কাস্টমার কিনতে রাজি হলে ধাপে ধাপে এই তথ্যগুলো সংগ্রহ করো (একসাথে সব জিজ্ঞেস
করবে না, স্বাভাবিক কথোপকথনের মতো একটা একটা করে):
1. কোন প্রোডাক্ট + সাইজ + রং + কয়টা
2. নাম
3. ফোন নম্বর
4. জেলা + এলাকা + বিস্তারিত ঠিকানা
5. Payment method (COD / বিকাশ / নগদ)

সব তথ্য পেলে **create_order** function call করো। Function successful হলে
customer কে confirm করে জানাও order number সহ, এবং আন্তরিকভাবে ধন্যবাদ দাও।

## Function Calling নিয়ম
- create_order কল করার আগে নিশ্চিত হও সব প্রয়োজনীয় তথ্য আছে
- তথ্য অসম্পূর্ণ থাকলে function call করবে না, বরং যা বাকি আছে সেটা জিজ্ঞেস করো
- check_order_status কল করবে যখন customer তার আগের অর্ডার সম্পর্কে জানতে চায়

## যা করবে না
- ভুল price/stock/policy বলবে না — সবসময় দেওয়া STORE DATA থেকে নাও
- Competitor এর নাম নেবে না
- Personal/sensitive info অযথা জিজ্ঞেস করবে না
- অতিরিক্ত commitment (unrealistic delivery time ইত্যাদি) দেবে না`;

// ── Function/Tool definitions (Groq OpenAI-compatible format) ──────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_order',
      description: 'Customer এর সব তথ্য (product, নাম, ফোন, ঠিকানা, payment method) সংগ্রহ হয়ে গেলে অর্ডার তৈরি করে। শুধু তখনই কল করো যখন সব তথ্য নিশ্চিত পাওয়া গেছে।',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'কাস্টমার যা যা অর্ডার করতে চায়',
            items: {
              type: 'object',
              properties: {
                productName: { type: 'string', description: 'প্রোডাক্টের নাম' },
                size:        { type: 'string', description: 'সাইজ যেমন M, L, XL' },
                color:       { type: 'string', description: 'রং' },
                quantity:    { type: 'number', description: 'কয়টা' },
              },
              required: ['productName', 'size', 'color', 'quantity'],
            },
          },
          customerName:  { type: 'string', description: 'কাস্টমারের নাম' },
          phone:         { type: 'string', description: 'ফোন নম্বর (১১ ডিজিট)' },
          district:      { type: 'string', description: 'জেলার নাম' },
          upazila:       { type: 'string', description: 'উপজেলা/থানা (থাকলে)' },
          area:          { type: 'string', description: 'এলাকার নাম' },
          address:       { type: 'string', description: 'বিস্তারিত ঠিকানা' },
          paymentMethod: { type: 'string', enum: ['cod', 'bkash', 'nagad'], description: 'পেমেন্ট মেথড' },
        },
        required: ['items', 'customerName', 'phone', 'district', 'area', 'address', 'paymentMethod'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_order_status',
      description: 'কাস্টমার তার আগের অর্ডারের status জানতে চাইলে এটা কল করো।',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'কাস্টমারের ফোন নম্বর' },
        },
        required: ['phone'],
      },
    },
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GroqResponse {
  reply: string;
  tokens: { input: number; output: number };
  orderCreated?: { orderNumber: string; total: number };
}

// ── Execute a tool call and return the result as text ───────────────────────────
async function executeToolCall(
  toolName: string,
  args: any,
  contactId: string
): Promise<{ resultText: string; orderCreated?: { orderNumber: string; total: number } }> {

  if (toolName === 'create_order') {
    const input: AIOrderInput = { ...args, contactId };
    const result = await createOrderFromAI(input);

    if (result.success) {
      return {
        resultText: `✅ অর্ডার সফলভাবে তৈরি হয়েছে!\nOrder Number: ${result.orderNumber}\nমোট মূল্য: ৳${result.total}`,
        orderCreated: { orderNumber: result.orderNumber!, total: result.total! },
      };
    }
    if (result.missingInfo?.length) {
      return { resultText: `আরো তথ্য দরকার: ${result.missingInfo.join(', ')}` };
    }
    return { resultText: `অর্ডার তৈরি করা যায়নি: ${result.error}` };
  }

  if (toolName === 'check_order_status') {
    const statusText = await checkOrderStatus(args.phone);
    return { resultText: statusText };
  }

  return { resultText: 'Unknown function' };
}

// ── Core Groq API call with function-calling support ────────────────────────────
async function callGroqWithTools(
  systemInstruction: string,
  messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] }[],
  contactId: string,
  model: string = TEXT_MODEL
): Promise<GroqResponse> {

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemInstruction }, ...messages],
      tools:       TOOLS,
      tool_choice: 'auto',
      temperature: 0.8,
      max_tokens:  600,
      top_p:       0.9,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq error: ${JSON.stringify(err)}`);
  }

  const data    = await res.json();
  const message = data.choices?.[0]?.message;
  const usage   = data.usage ?? {};

  // ── Model কি কোনো function কল করতে চাইছে? ──────────────────────────────────
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0];
    const args     = JSON.parse(toolCall.function.arguments);

    const { resultText, orderCreated } = await executeToolCall(
      toolCall.function.name, args, contactId
    );

    // Tool result সহ আবার call করবো যাতে model সেটা দিয়ে একটা natural reply বানায়
    const followUpMessages = [
      ...messages,
      { role: 'assistant' as const, content: message.content ?? '', tool_calls: message.tool_calls },
      { role: 'tool' as const, content: resultText, tool_call_id: toolCall.id },
    ];

    const followUp = await callGroqWithTools(systemInstruction, followUpMessages, contactId, model);
    return { ...followUp, orderCreated: orderCreated ?? followUp.orderCreated };
  }

  return {
    reply: (message?.content ?? '').trim(),
    tokens: {
      input:  usage.prompt_tokens     ?? 0,
      output: usage.completion_tokens ?? 0,
    },
  };
}

// ── Main: Salesman reply with Firestore context + order-taking ability ─────────
export async function generateSmartReply(
  userMessage:  string,
  storeContext: string,
  history:      ChatMessage[] = [],
  contactId:    string = 'unknown'
): Promise<GroqResponse> {

  const systemPrompt = `${SALESMAN_PROMPT}\n\n${storeContext}`;

  const messages = [
    ...history.slice(-10).map(m => ({
      role:    (m.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  return callGroqWithTools(systemPrompt, messages, contactId);
}

// ── Vision fallback: কাস্টমার ছবি পাঠালে এটা ব্যবহার হবে ───────────────────────
export async function generateVisionReply(
  imageUrl:     string,
  userText:     string,
  storeContext: string,
  contactId:    string = 'unknown'
): Promise<GroqResponse> {

  const systemPrompt = `${SALESMAN_PROMPT}\n\n${storeContext}`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText || 'এই প্রোডাক্টটা কি available আছে? দাম কত?' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.7,
      max_tokens:  500,
    }),
  });

  if (!res.ok) {
    // Vision fail করলে graceful fallback — text দিয়ে সাধারণ reply
    console.warn('[Groq Vision] Failed, falling back to text-only');
    return generateSmartReply(
      '[কাস্টমার একটা প্রোডাক্ট ছবি পাঠিয়েছে কিন্তু এই মুহূর্তে ছবি দেখা যাচ্ছে না]',
      storeContext, [], contactId
    );
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

// ── Abandoned cart reminder (salesman tone) ──────────────────────────────────────
export async function generateCartReminder(cart: {
  customerName: string;
  items: { name: string; size: string; qty: number; price: number }[];
  totalAmount: number;
}): Promise<string> {
  const itemList = cart.items
    .map(i => `- ${i.name} (${i.size}) x ${i.qty} = ৳${i.price * i.qty}`)
    .join('\n');

  const prompt =
    `BrotherFit এর sales rep হিসেবে সম্পূর্ণ বাংলায় একটা convincing WhatsApp cart ` +
    `reminder লেখো যা customer কে checkout complete করতে উৎসাহিত করবে।\n\n` +
    `Customer: ${cart.customerName}\nCart:\n${itemList}\nTotal: ৳${cart.totalAmount}\n\n` +
    `নিয়ম: warm+convincing tone, ৫-৬ লাইনের মধ্যে, একটা mild urgency যোগ করো ` +
    `(যেমন stock limited), brotherfit.vercel.app/cart link দাও, ২-৩টা emoji, সম্পূর্ণ বাংলায়`;

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: SALESMAN_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens:  300,
    }),
  });

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

// ── Intent classifier ────────────────────────────────────────────────────────────
export async function classifyIntent(message: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: 'system', content: 'You are a classifier. Return only the category name in English, nothing else.' },
        { role: 'user', content:
          `এই কাস্টমার মেসেজটি classify করো।\nMessage: "${message}"\n` +
          `Categories: product_inquiry, price, size, order_intent, order_status, payment, ` +
          `return, greeting, complaint, other\nশুধু category নামটা লিখো।`
        },
      ],
      temperature: 0.1,
      max_tokens:  20,
    }),
  });

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? 'other').toLowerCase().trim();
}
