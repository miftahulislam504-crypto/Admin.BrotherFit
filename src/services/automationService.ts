// src/services/automationService.ts
// BrotherFit Admin — Automation Engine (Firebase/Firestore)

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { MetaAPI } from '@/lib/meta-api';

// ── Types ─────────────────────────────────────────────────

export type Platform = 'facebook' | 'instagram' | 'whatsapp' | 'all';
export type TriggerType = 'message_received' | 'keyword_match' | 'new_lead' | 'order_placed';
export type ContactStatus = 'new' | 'lead' | 'customer' | 'vip';
export type MessageDirection = 'inbound' | 'outbound';

export interface AutoContact {
  id: string;
  name: string | null;
  phone: string | null;
  facebookId: string | null;
  instagramId: string | null;
  whatsappId: string | null;
  platform: string;
  status: ContactStatus;
  tags: string[];
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  createdAt: Date;
}

export interface AutoMessage {
  id: string;
  contactId: string;
  platform: string;
  direction: MessageDirection;
  content: string;
  platformMessageId: string | null;
  isRead: boolean;
  createdAt: Date;
}

export interface AutoRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  platform: Platform;
  triggerType: TriggerType;
  conditions: {
    keywords?: string[];
    keyword?: string;
    operator?: 'contains' | 'equals' | 'starts_with';
  } | null;
  actions: AutoAction[];
  delayMinutes: number;
  priority: number;
  runOncePerContact: boolean;
  createdAt: Date;
}

export interface AutoAction {
  type: 'send_message' | 'add_tag' | 'remove_tag' | 'update_status' | 'create_lead' | 'notify_admin';
  message?: string;
  tag?: string;
  status?: ContactStatus;
  interest?: string;
}

export interface BroadcastCampaign {
  id: string;
  name: string;
  platform: Exclude<Platform, 'all'>;
  message: string;
  targetTags: string[];
  status: 'draft' | 'sending' | 'sent' | 'failed';
  sentCount: number;
  failedCount: number;
  totalCount: number;
  createdAt: Date;
  sentAt: Date | null;
}

// ── Helpers ───────────────────────────────────────────────

const toDate = (v: any): Date => v instanceof Timestamp ? v.toDate() : new Date(v ?? Date.now());

const fromContactDoc = (doc: any): AutoContact => ({
  id: doc.id,
  name: doc.data().name ?? null,
  phone: doc.data().phone ?? null,
  facebookId: doc.data().facebookId ?? null,
  instagramId: doc.data().instagramId ?? null,
  whatsappId: doc.data().whatsappId ?? null,
  platform: doc.data().platform ?? 'unknown',
  status: doc.data().status ?? 'new',
  tags: doc.data().tags ?? [],
  lastMessage: doc.data().lastMessage ?? null,
  lastMessageAt: doc.data().lastMessageAt ? toDate(doc.data().lastMessageAt) : null,
  unreadCount: doc.data().unreadCount ?? 0,
  createdAt: toDate(doc.data().createdAt),
});

const fromMsgDoc = (doc: any): AutoMessage => ({
  id: doc.id,
  contactId: doc.data().contactId,
  platform: doc.data().platform,
  direction: doc.data().direction,
  content: doc.data().content,
  platformMessageId: doc.data().platformMessageId ?? null,
  isRead: doc.data().isRead ?? false,
  createdAt: toDate(doc.data().createdAt),
});

const fromRuleDoc = (doc: any): AutoRule => ({
  id: doc.id,
  name: doc.data().name,
  description: doc.data().description ?? '',
  isActive: doc.data().isActive ?? true,
  platform: doc.data().platform ?? 'all',
  triggerType: doc.data().triggerType,
  conditions: doc.data().conditions ?? null,
  actions: doc.data().actions ?? [],
  delayMinutes: doc.data().delayMinutes ?? 0,
  priority: doc.data().priority ?? 0,
  runOncePerContact: doc.data().runOncePerContact ?? false,
  createdAt: toDate(doc.data().createdAt),
});

// ── Contact CRUD ──────────────────────────────────────────

export async function getContacts(limitCount = 50): Promise<AutoContact[]> {
  const snap = await getDocs(
    query(collection(db, 'automation_contacts'),
      orderBy('lastMessageAt', 'desc'), limit(limitCount))
  );
  return snap.docs.map(fromContactDoc);
}

export async function getContact(id: string): Promise<AutoContact | null> {
  const snap = await getDoc(doc(db, 'automation_contacts', id));
  return snap.exists() ? fromContactDoc(snap) : null;
}

export async function findOrCreateContact(
  platform: string,
  platformId: string,
  name?: string
): Promise<AutoContact> {
  const platformField = platform === 'facebook' ? 'facebookId'
    : platform === 'instagram' ? 'instagramId' : 'whatsappId';

  const snap = await getDocs(
    query(collection(db, 'automation_contacts'), where(platformField, '==', platformId))
  );

  if (!snap.empty) {
    const existing = fromContactDoc(snap.docs[0]);
    // Update name if missing
    if (name && !existing.name) {
      await updateDoc(doc(db, 'automation_contacts', existing.id), { name });
      existing.name = name;
    }
    return existing;
  }

  const newDoc = await addDoc(collection(db, 'automation_contacts'), {
    [platformField]: platformId,
    name: name ?? null, platform, status: 'new', tags: [],
    lastMessage: null, lastMessageAt: null, unreadCount: 0,
    createdAt: serverTimestamp(),
  });
  const fresh = await getDoc(newDoc);
  return fromContactDoc(fresh);
}

export async function updateContact(id: string, data: Partial<Omit<AutoContact, 'id' | 'createdAt'>>) {
  await updateDoc(doc(db, 'automation_contacts', id), { ...data });
}

export async function addTagToContact(contactId: string, tag: string) {
  const contact = await getContact(contactId);
  if (!contact) return;
  const tags = contact.tags.includes(tag) ? contact.tags : [...contact.tags, tag];
  await updateDoc(doc(db, 'automation_contacts', contactId), { tags });
}

// ── Messages CRUD ─────────────────────────────────────────

export async function getMessages(contactId: string, limitCount = 50): Promise<AutoMessage[]> {
  const snap = await getDocs(
    query(collection(db, 'automation_messages'),
      where('contactId', '==', contactId),
      orderBy('createdAt', 'asc'), limit(limitCount))
  );
  return snap.docs.map(fromMsgDoc);
}

export async function saveMessage(data: {
  contactId: string; platform: string; direction: MessageDirection;
  content: string; platformMessageId?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'automation_messages'), {
    ...data, isRead: data.direction === 'outbound',
    createdAt: serverTimestamp(),
  });
  // Update contact's last message
  await updateDoc(doc(db, 'automation_contacts', data.contactId), {
    lastMessage: data.content.substring(0, 80),
    lastMessageAt: serverTimestamp(),
    ...(data.direction === 'inbound' ? {} : {}),
  });
  return ref.id;
}

export async function markAsRead(contactId: string) {
  await updateDoc(doc(db, 'automation_contacts', contactId), { unreadCount: 0 });
}

// Admin manual reply
export async function sendReply(contactId: string, text: string) {
  const contact = await getContact(contactId);
  if (!contact) throw new Error('Contact not found');

  const platformId = contact.facebookId ?? contact.instagramId ?? contact.whatsappId;
  if (!platformId) throw new Error('No platform ID');

  await MetaAPI.send(contact.platform, platformId, text);
  await saveMessage({ contactId, platform: contact.platform, direction: 'outbound', content: text });
}

// ── Rules CRUD ────────────────────────────────────────────

export async function getRules(): Promise<AutoRule[]> {
  const snap = await getDocs(
    query(collection(db, 'automation_rules'), orderBy('priority', 'desc'))
  );
  return snap.docs.map(fromRuleDoc);
}

export async function createRule(data: Omit<AutoRule, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'automation_rules'), {
    ...data, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRule(id: string, data: Partial<Omit<AutoRule, 'id' | 'createdAt'>>) {
  await updateDoc(doc(db, 'automation_rules', id), { ...data });
}

export async function deleteRule(id: string) {
  await deleteDoc(doc(db, 'automation_rules', id));
}

export async function toggleRule(id: string, isActive: boolean) {
  await updateDoc(doc(db, 'automation_rules', id), { isActive });
}

// ── Automation Engine ─────────────────────────────────────

export interface IncomingEvent {
  senderId: string;
  content: string;
  platform: 'facebook' | 'instagram' | 'whatsapp';
  platformMessageId?: string;
  senderName?: string;
}

export async function processIncoming(event: IncomingEvent) {
  // 1. Find or create contact
  const contact = await findOrCreateContact(event.platform, event.senderId, event.senderName);

  // 2. Save inbound message
  await saveMessage({
    contactId: contact.id, platform: event.platform,
    direction: 'inbound', content: event.content,
    platformMessageId: event.platformMessageId,
  });

  // Update unread count
  await updateDoc(doc(db, 'automation_contacts', contact.id), {
    unreadCount: (contact.unreadCount ?? 0) + 1,
  });

  // 3. Get active rules
  const rulesSnap = await getDocs(
    query(collection(db, 'automation_rules'), where('isActive', '==', true))
  );
  const rules: AutoRule[] = rulesSnap.docs.map(fromRuleDoc)
    .sort((a, b) => b.priority - a.priority);

  // 4. Match and execute rules
  for (const rule of rules) {
    if (!matchesRule(rule, event)) continue;

    // runOncePerContact check
    if (rule.runOncePerContact) {
      const alreadyRan = await getDocs(query(
        collection(db, 'automation_logs'),
        where('ruleId', '==', rule.id),
        where('contactId', '==', contact.id),
        where('status', '==', 'success'), limit(1)
      ));
      if (!alreadyRan.empty) continue;
    }

    // Execute actions with delay
    if (rule.delayMinutes > 0) {
      await addDoc(collection(db, 'automation_queue'), {
        ruleId: rule.id, contactId: contact.id,
        event, status: 'pending',
        processAt: new Date(Date.now() + rule.delayMinutes * 60000),
        createdAt: serverTimestamp(),
      });
    } else {
      await executeRule(rule, contact, event);
    }
  }
}

function matchesRule(rule: AutoRule, event: IncomingEvent): boolean {
  if (rule.platform !== 'all' && rule.platform !== event.platform) return false;
  if (!rule.conditions) return true;

  const content = event.content.toLowerCase();
  const { keywords, keyword, operator = 'contains' } = rule.conditions;

  if (keywords?.length) {
    return keywords.some(kw => content.includes(kw.toLowerCase()));
  }
  if (keyword) {
    switch (operator) {
      case 'contains':    return content.includes(keyword.toLowerCase());
      case 'equals':      return content === keyword.toLowerCase();
      case 'starts_with': return content.startsWith(keyword.toLowerCase());
      default:            return content.includes(keyword.toLowerCase());
    }
  }
  return true;
}

async function executeRule(rule: AutoRule, contact: AutoContact, event: IncomingEvent) {
  for (const action of rule.actions) {
    try {
      await executeAction(action, contact, event);
      await addDoc(collection(db, 'automation_logs'), {
        ruleId: rule.id, ruleName: rule.name,
        contactId: contact.id, actionType: action.type,
        status: 'success', createdAt: serverTimestamp(),
      });
    } catch (err: any) {
      console.error(`[Automation] Action ${action.type} failed:`, err.message);
      await addDoc(collection(db, 'automation_logs'), {
        ruleId: rule.id, ruleName: rule.name,
        contactId: contact.id, actionType: action.type,
        status: 'failed', error: err.message, createdAt: serverTimestamp(),
      });
    }
  }
}

async function executeAction(action: AutoAction, contact: AutoContact, event: IncomingEvent) {
  switch (action.type) {
    case 'send_message': {
      const text = (action.message ?? '').replace('{{name}}', contact.name ?? 'বন্ধু');
      const platformId = contact.facebookId ?? contact.instagramId ?? contact.whatsappId;
      if (platformId) await MetaAPI.send(event.platform, platformId, text);
      await saveMessage({ contactId: contact.id, platform: event.platform, direction: 'outbound', content: text });
      break;
    }
    case 'add_tag':
      if (action.tag) await addTagToContact(contact.id, action.tag);
      break;
    case 'update_status':
      if (action.status) await updateContact(contact.id, { status: action.status });
      break;
    case 'create_lead': {
      const existing = await getDocs(query(
        collection(db, 'automation_leads'),
        where('contactId', '==', contact.id), limit(1)
      ));
      if (existing.empty) {
        await addDoc(collection(db, 'automation_leads'), {
          contactId: contact.id, source: event.platform,
          interest: action.interest ?? 'general', status: 'new',
          createdAt: serverTimestamp(),
        });
      }
      break;
    }
    case 'notify_admin': {
      const adminWA = process.env.ADMIN_WHATSAPP_NUMBER;
      if (adminWA) {
        await MetaAPI.sendWhatsApp(adminWA,
          `🔔 BrotherFit Alert!\nPlatform: ${event.platform}\nMessage: ${event.content}\n— ${action.message ?? ''}`
        );
      }
      break;
    }
  }
}

// ── Broadcast ─────────────────────────────────────────────

export async function getBroadcasts(): Promise<BroadcastCampaign[]> {
  const snap = await getDocs(
    query(collection(db, 'broadcast_campaigns'), orderBy('createdAt', 'desc'), limit(30))
  );
  return snap.docs.map(d => ({
    id: d.id, ...(d.data() as any),
    createdAt: toDate(d.data().createdAt),
    sentAt: d.data().sentAt ? toDate(d.data().sentAt) : null,
  }));
}

export async function createBroadcast(data: Omit<BroadcastCampaign, 'id' | 'createdAt' | 'sentAt' | 'status' | 'sentCount' | 'failedCount' | 'totalCount'>): Promise<string> {
  const ref = await addDoc(collection(db, 'broadcast_campaigns'), {
    ...data, status: 'draft', sentCount: 0, failedCount: 0, totalCount: 0,
    createdAt: serverTimestamp(), sentAt: null,
  });
  return ref.id;
}

export async function sendBroadcast(id: string) {
  const snap = await getDoc(doc(db, 'broadcast_campaigns', id));
  if (!snap.exists()) throw new Error('Campaign not found');
  const campaign = snap.data() as any;

  await updateDoc(doc(db, 'broadcast_campaigns', id), { status: 'sending' });

  // Get target contacts
  let q = query(collection(db, 'automation_contacts'),
    where('platform', '==', campaign.platform));

  if (campaign.targetTags?.length) {
    q = query(collection(db, 'automation_contacts'),
      where('platform', '==', campaign.platform),
      where('tags', 'array-contains-any', campaign.targetTags));
  }

  const contactsSnap = await getDocs(q);
  const contacts = contactsSnap.docs.map(fromContactDoc);

  const phones = contacts
    .map(c => c.whatsappId ?? c.facebookId ?? c.instagramId)
    .filter(Boolean) as string[];

  const { success, failed } = await MetaAPI.broadcast(phones, campaign.message);

  await updateDoc(doc(db, 'broadcast_campaigns', id), {
    status: 'sent', sentCount: success, failedCount: failed,
    totalCount: phones.length, sentAt: serverTimestamp(),
  });

  return { success, failed, total: phones.length };
}

// ── Stats ─────────────────────────────────────────────────

export async function getAutomationStats() {
  const [contacts, messages, rules, logs] = await Promise.all([
    getDocs(collection(db, 'automation_contacts')),
    getDocs(query(collection(db, 'automation_messages'), where('direction', '==', 'inbound'),
      orderBy('createdAt', 'desc'), limit(1000))),
    getDocs(query(collection(db, 'automation_rules'), where('isActive', '==', true))),
    getDocs(query(collection(db, 'automation_logs'), orderBy('createdAt', 'desc'), limit(200))),
  ]);

  const unread = contacts.docs.filter(d => (d.data().unreadCount ?? 0) > 0).length;

  return {
    totalContacts: contacts.size,
    totalMessages: messages.size,
    activeRules: rules.size,
    successLogs: logs.docs.filter(d => d.data().status === 'success').length,
    unreadChats: unread,
  };
}

// ── Default Rules Seed ────────────────────────────────────

export async function seedDefaultRules() {
  const existing = await getDocs(collection(db, 'automation_rules'));
  if (!existing.empty) return; // Already seeded

  const defaultRules: Omit<AutoRule, 'id' | 'createdAt'>[] = [
    {
      name: 'Price Inquiry Auto Reply', description: 'দাম জিজ্ঞেস করলে price list পাঠাবে',
      isActive: true, platform: 'all', triggerType: 'keyword_match', priority: 10,
      conditions: { keywords: ['price', 'দাম', 'কত', 'cost', 'rate', 'মূল্য'] },
      actions: [{
        type: 'send_message',
        message: '🛍️ BrotherFit Price List:\n\n👕 Oversized T-Shirt: ৳৩৯৯-৫৯৯\n👖 Joggers: ৳৬৯৯-৮৯৯\n🧢 Cap: ৳২৯৯\n\n🔥 Bundle: T-Shirt + Jogger = ৳৯৯৯\n\n🛒 Order: brotherfit.com',
      }, { type: 'add_tag', tag: 'price_inquiry' }, { type: 'create_lead', interest: 'pricing' }],
      delayMinutes: 0, runOncePerContact: false,
    },
    {
      name: 'Size Guide Auto Reply', description: 'সাইজ জিজ্ঞেস করলে size chart পাঠাবে',
      isActive: true, platform: 'all', triggerType: 'keyword_match', priority: 9,
      conditions: { keywords: ['size', 'সাইজ', 'fitting', 'measurement', 'মাপ'] },
      actions: [{
        type: 'send_message',
        message: '📏 BrotherFit Size Guide:\n\nS → Chest 36" | M → 38"\nL → Chest 40" | XL → 42"\nXXL → Chest 44"\n\n🤔 আপনার chest size বলুন!',
      }, { type: 'add_tag', tag: 'size_inquiry' }],
      delayMinutes: 0, runOncePerContact: false,
    },
    {
      name: 'Welcome New Contact', description: 'নতুন contact কে welcome message',
      isActive: true, platform: 'all', triggerType: 'message_received', priority: 1,
      conditions: null,
      actions: [{
        type: 'send_message',
        message: '👋 আস-সালামু আলাইকুম! BrotherFit এ স্বাগতম! 🛍️\n\n💬 দাম → "price"\n📏 Size → "size"\n📦 Order → "order"\n\nJazakAllahu Khayran! 🤲',
      }, { type: 'add_tag', tag: 'new_contact' }, { type: 'update_status', status: 'lead' }],
      delayMinutes: 0, runOncePerContact: true,
    },
  ];

  const batch = writeBatch(db);
  for (const rule of defaultRules) {
    const ref = doc(collection(db, 'automation_rules'));
    batch.set(ref, { ...rule, createdAt: serverTimestamp() });
  }
  await batch.commit();
}
