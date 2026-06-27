'use client';

// src/app/(admin)/inbox/page.tsx
// BrotherFit Admin — Unified Inbox (FB + IG + WA)

import { useEffect, useState, useRef } from 'react';
import {
  Search, Send, RefreshCw, Facebook, Instagram,
  MessageCircle, Circle, Tag, User, Clock, Sparkles, Loader2,
} from 'lucide-react';
import {
  getContacts, getMessages, sendReply, markAsRead, updateContact,
  type AutoContact, type AutoMessage,
} from '@/services/automationService';
import { formatDateTime, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ── Platform badge ────────────────────────────────────────
const PlatformIcon = ({ platform, size = 14 }: { platform: string; size?: number }) => {
  if (platform === 'facebook')  return <Facebook  size={size} className="text-blue-500"  />;
  if (platform === 'instagram') return <Instagram size={size} className="text-pink-500"  />;
  return <MessageCircle size={size} className="text-green-500" />;
};

const PlatformLabel: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp',
};

// ── Status badge ──────────────────────────────────────────
const StatusColors: Record<string, string> = {
  new:      'bg-blue-50   text-blue-700  border-blue-200',
  lead:     'bg-amber-50  text-amber-700 border-amber-200',
  customer: 'bg-green-50  text-green-700 border-green-200',
  vip:      'bg-violet-50 text-violet-700 border-violet-200',
};

// ── Contact list item ─────────────────────────────────────
function ContactItem({
  contact, selected, onClick,
}: { contact: AutoContact; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3.5 border-b border-border text-left',
        'hover:bg-bg/70 transition-colors',
        selected && 'bg-accent/10 border-l-2 border-l-accent',
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User size={18} className="text-primary/60" />
        </div>
        <span className="absolute -bottom-0.5 -right-0.5">
          <PlatformIcon platform={contact.platform} size={12} />
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm text-primary truncate">
            {contact.name ?? contact.whatsappId ?? contact.facebookId ?? 'Unknown'}
          </span>
          {contact.lastMessageAt && (
            <span className="text-[10px] text-muted shrink-0">
              {new Date(contact.lastMessageAt).toLocaleTimeString('en-BD',
                { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <p className="text-xs text-muted truncate mt-0.5">
          {contact.lastMessage ?? 'No messages yet'}
        </p>
      </div>

      {/* Unread badge */}
      {(contact.unreadCount ?? 0) > 0 && (
        <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-accent text-white
                         text-[10px] font-bold flex items-center justify-center px-1">
          {contact.unreadCount}
        </span>
      )}
    </button>
  );
}

// ── Chat bubble ───────────────────────────────────────────
function ChatBubble({ msg }: { msg: AutoMessage }) {
  const isOut = msg.direction === 'outbound';
  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap shadow-sm',
        isOut
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-surface border border-border text-text rounded-bl-sm',
      )}>
        {msg.content}
        <div className={cn('text-[10px] mt-1', isOut ? 'text-white/60' : 'text-muted')}>
          {new Date(msg.createdAt).toLocaleTimeString('en-BD',
            { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function InboxPage() {
  const [contacts,  setContacts]  = useState<AutoContact[]>([]);
  const [messages,  setMessages]  = useState<AutoMessage[]>([]);
  const [selected,  setSelected]  = useState<AutoContact | null>(null);
  const [search,    setSearch]    = useState('');
  const [reply,     setReply]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [msgLoad,   setMsgLoad]   = useState(false);
  const [filter,    setFilter]    = useState<string>('all');
  const [aiLoading, setAiLoading] = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);

  const loadContacts = async () => {
    setLoading(true);
    const data = await getContacts(100);
    setContacts(data);
    setLoading(false);
  };

  useEffect(() => { loadContacts(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectContact = async (contact: AutoContact) => {
    setSelected(contact);
    setMsgLoad(true);
    const msgs = await getMessages(contact.id);
    setMessages(msgs);
    setMsgLoad(false);
    if ((contact.unreadCount ?? 0) > 0) {
      await markAsRead(contact.id);
      setContacts(prev => prev.map(c =>
        c.id === contact.id ? { ...c, unreadCount: 0 } : c
      ));
    }
  };

  const handleSend = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await sendReply(selected.id, reply.trim());
      const newMsg: AutoMessage = {
        id: Date.now().toString(), contactId: selected.id,
        platform: selected.platform, direction: 'outbound',
        content: reply.trim(), platformMessageId: null, isRead: true,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, newMsg]);
      setReply('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAiReply = async () => {
    if (!selected) return;
    // Get last user message from messages
    const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound');
    if (!lastInbound) { toast.error('No message to reply to'); return; }

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: selected.id, message: lastInbound.content }),
      });
      const data = await res.json();
      if (data.reply) {
        setReply(data.reply);
        toast.success('AI reply generated — review before sending');
      } else {
        toast.error('AI failed to generate reply');
      }
    } catch {
      toast.error('AI reply error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleStatusChange = async (status: AutoContact['status']) => {
    if (!selected) return;
    await updateContact(selected.id, { status });
    setSelected(prev => prev ? { ...prev, status } : null);
    setContacts(prev => prev.map(c => c.id === selected.id ? { ...c, status } : c));
    toast.success('Status updated');
  };

  const filtered = contacts.filter(c => {
    const name = (c.name ?? c.whatsappId ?? c.facebookId ?? '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.platform === filter
      || (filter === 'unread' && (c.unreadCount ?? 0) > 0);
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex h-[calc(100vh-120px)] border border-border rounded-2xl overflow-hidden bg-surface shadow-card">

      {/* ── Left: Contact List ──────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-border">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-base text-primary">Inbox</h2>
            <button onClick={loadContacts}
              className="p-1.5 rounded-lg hover:bg-bg text-muted hover:text-primary transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="input-field pl-8 text-sm py-2" />
          </div>

          {/* Platform filter */}
          <div className="flex gap-1 mt-2">
            {['all', 'facebook', 'instagram', 'whatsapp', 'unread'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn(
                  'flex-1 text-[10px] font-medium py-1 rounded-lg border transition-all capitalize',
                  filter === f
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted hover:border-accent',
                )}>
                {f === 'all' ? 'All' : f === 'unread' ? '🔴' :
                  f === 'facebook' ? 'FB' : f === 'instagram' ? 'IG' : 'WA'}
              </button>
            ))}
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-border animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-border rounded animate-pulse w-2/3" />
                  <div className="h-2.5 bg-border rounded animate-pulse w-full" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted">
              <MessageCircle size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No contacts yet</p>
            </div>
          ) : (
            filtered.map(c => (
              <ContactItem key={c.id} contact={c}
                selected={selected?.id === c.id}
                onClick={() => selectContact(c)} />
            ))
          )}
        </div>

        {/* Footer count */}
        <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted">
          {filtered.length} contacts
        </div>
      </div>

      {/* ── Right: Chat Panel ───────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">

          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary/60" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-primary">
                    {selected.name ?? 'Unknown'}
                  </span>
                  <PlatformIcon platform={selected.platform} />
                  <span className="text-[10px] text-muted">
                    {PlatformLabel[selected.platform]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Circle size={6} className="fill-green-400 text-green-400" />
                  <span className="text-[10px] text-muted">
                    {selected.whatsappId ?? selected.facebookId ?? selected.instagramId}
                  </span>
                </div>
              </div>
            </div>

            {/* Status + Tags */}
            <div className="flex items-center gap-2">
              {selected.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag size={11} className="text-muted" />
                  {selected.tags.slice(0, 2).map(t => (
                    <span key={t} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <select
                value={selected.status}
                onChange={e => handleStatusChange(e.target.value as AutoContact['status'])}
                className={cn(
                  'text-xs font-medium px-2 py-1 rounded-lg border transition-all cursor-pointer',
                  StatusColors[selected.status]
                )}
              >
                <option value="new">New</option>
                <option value="lead">Lead</option>
                <option value="customer">Customer</option>
                <option value="vip">VIP</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-bg/40">
            {msgLoad ? (
              <div className="flex items-center justify-center h-full text-muted text-sm">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted">
                <MessageCircle size={32} className="mb-2 opacity-20" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              <>
                {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          {/* Reply input */}
          <div className="p-4 border-t border-border shrink-0 space-y-2">
            {/* AI suggestion bar */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">
                {reply ? `${reply.length} chars` : 'Type a reply or use AI'}
              </span>
              <button
                onClick={handleAiReply}
                disabled={aiLoading || !messages.some(m => m.direction === 'inbound')}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all',
                  'bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed',
                )}>
                {aiLoading
                  ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                  : <><Sparkles size={12} /> AI Reply</>}
              </button>
            </div>
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); handleSend();
                  }
                }}
                placeholder={`Reply via ${PlatformLabel[selected.platform]}... (Enter to send)`}
                rows={2}
                className="input-field flex-1 text-sm resize-none py-2.5"
              />
              <button onClick={handleSend} disabled={sending || !reply.trim()}
                className="btn-primary px-4 self-end">
                {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted bg-bg/30">
          <MessageCircle size={48} className="mb-3 opacity-20" />
          <p className="text-sm font-medium">Select a conversation</p>
          <p className="text-xs mt-1 opacity-70">Facebook, Instagram & WhatsApp messages</p>
        </div>
      )}
    </div>
  );
}
