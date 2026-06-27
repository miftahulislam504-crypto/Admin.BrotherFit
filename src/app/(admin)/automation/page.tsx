'use client';

// src/app/(admin)/automation/page.tsx
// BrotherFit Admin — Automation Rules

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Zap, Plus, ToggleLeft, ToggleRight, Trash2,
  Edit3, Facebook, Instagram, MessageCircle,
  Globe, ChevronRight, AlertCircle,
} from 'lucide-react';
import {
  getRules, toggleRule, deleteRule, seedDefaultRules,
  getAutomationStats, type AutoRule,
} from '@/services/automationService';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

// ── Platform icon ─────────────────────────────────────────
const PlatformBadge = ({ platform }: { platform: string }) => {
  const map: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    all:       { icon: <Globe size={11} />,         label: 'All',       color: 'bg-gray-100 text-gray-600' },
    facebook:  { icon: <Facebook size={11} />,      label: 'Facebook',  color: 'bg-blue-50 text-blue-600' },
    instagram: { icon: <Instagram size={11} />,     label: 'Instagram', color: 'bg-pink-50 text-pink-600' },
    whatsapp:  { icon: <MessageCircle size={11} />, label: 'WhatsApp',  color: 'bg-green-50 text-green-600' },
  };
  const p = map[platform] ?? map.all;
  return (
    <span className={cn('flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', p.color)}>
      {p.icon} {p.label}
    </span>
  );
};

// ── Trigger badge ─────────────────────────────────────────
const TriggerBadge = ({ type }: { type: string }) => {
  const map: Record<string, string> = {
    message_received: 'Message Received',
    keyword_match:    'Keyword Match',
    new_lead:         'New Lead',
    order_placed:     'Order Placed',
  };
  return (
    <span className="text-[10px] font-medium bg-accent/10 text-accent px-2 py-0.5 rounded-full">
      {map[type] ?? type}
    </span>
  );
};

// ── Action chip ───────────────────────────────────────────
const ActionChip = ({ action }: { action: AutoRule['actions'][0] }) => {
  const labels: Record<string, string> = {
    send_message:   '💬 Send Message',
    add_tag:        `🏷️ Tag: ${action.tag ?? ''}`,
    update_status:  `📌 Status: ${action.status ?? ''}`,
    create_lead:    '👤 Create Lead',
    notify_admin:   '🔔 Notify Admin',
  };
  return (
    <span className="text-[10px] bg-border/60 text-text px-2 py-0.5 rounded-md">
      {labels[action.type] ?? action.type}
    </span>
  );
};

// ── Stat card ─────────────────────────────────────────────
function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="card card-inner flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-semibold text-primary">{value}</p>
        <p className="text-[11px] text-muted">{label}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function AutomationPage() {
  const [rules,   setRules]   = useState<AutoRule[]>([]);
  const [stats,   setStats]   = useState({ totalContacts: 0, totalMessages: 0, activeRules: 0, successLogs: 0, unreadChats: 0 });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, s] = await Promise.all([getRules(), getAutomationStats()]);
    setRules(r); setStats(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string, current: boolean) => {
    await toggleRule(id, !current);
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !current } : r));
    toast.success(!current ? 'Rule activated' : 'Rule paused');
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete rule "${name}"?`)) return;
    await deleteRule(id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success('Rule deleted');
  };

  const handleSeed = async () => {
    setSeeding(true);
    await seedDefaultRules();
    await load();
    setSeeding(false);
    toast.success('Default rules seeded!');
  };

  return (
    <div className="space-y-5 max-w-6xl">

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Contacts"  value={stats.totalContacts}  icon={<MessageCircle size={16} className="text-blue-600" />}   color="bg-blue-50"   />
        <StatCard label="Messages"        value={stats.totalMessages}  icon={<Zap          size={16} className="text-amber-600" />}   color="bg-amber-50"  />
        <StatCard label="Active Rules"    value={stats.activeRules}    icon={<ToggleRight  size={16} className="text-green-600" />}   color="bg-green-50"  />
        <StatCard label="Actions Run"     value={stats.successLogs}    icon={<ChevronRight size={16} className="text-violet-600" />}  color="bg-violet-50" />
        <StatCard label="Unread Chats"    value={stats.unreadChats}    icon={<AlertCircle  size={16} className="text-red-600" />}     color="bg-red-50"    />
      </div>

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg text-primary">Automation Rules</h2>
          <p className="text-xs text-muted mt-0.5">
            Auto-reply, tag, and action rules for FB, IG & WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rules.length === 0 && !loading && (
            <button onClick={handleSeed} disabled={seeding} className="btn-outline text-sm">
              {seeding ? 'Seeding…' : '✨ Load Default Rules'}
            </button>
          )}
          <Link href="/automation/builder" className="btn-primary text-sm">
            <Plus size={14} /> New Rule
          </Link>
        </div>
      </div>

      {/* ── Rules Table ──────────────────────────────────── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <Zap size={36} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No rules yet</p>
            <p className="text-xs mt-1">Create a rule or load defaults to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rules.map(rule => (
              <div key={rule.id}
                className={cn(
                  'flex items-start gap-4 p-4 transition-colors',
                  rule.isActive ? 'bg-surface hover:bg-bg/40' : 'bg-bg/60 opacity-60',
                )}>

                {/* Priority badge */}
                <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/5 flex items-center
                                justify-center text-xs font-bold text-primary mt-0.5">
                  {rule.priority}
                </div>

                {/* Rule info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1.5">
                    <span className="font-medium text-sm text-primary">{rule.name}</span>
                    <PlatformBadge platform={rule.platform} />
                    <TriggerBadge type={rule.triggerType} />
                    {rule.runOncePerContact && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Once per contact
                      </span>
                    )}
                    {rule.delayMinutes > 0 && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        ⏱ {rule.delayMinutes}m delay
                      </span>
                    )}
                  </div>

                  {/* Keywords */}
                  {rule.conditions?.keywords && (
                    <p className="text-xs text-muted mb-1.5">
                      Keywords: <span className="text-primary font-medium">
                        {rule.conditions.keywords.join(', ')}
                      </span>
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-1">
                    {rule.actions.map((a, i) => <ActionChip key={i} action={a} />)}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <Link href={`/automation/builder?edit=${rule.id}`}
                    className="p-2 rounded-lg hover:bg-border text-muted hover:text-primary transition-colors">
                    <Edit3 size={14} />
                  </Link>
                  <button onClick={() => handleToggle(rule.id, rule.isActive)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      rule.isActive
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-muted hover:bg-border',
                    )}>
                    {rule.isActive
                      ? <ToggleRight size={18} />
                      : <ToggleLeft  size={18} />}
                  </button>
                  <button onClick={() => handleDelete(rule.id, rule.name)}
                    className="p-2 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Info box ─────────────────────────────────────── */}
      <div className="card card-inner bg-accent/5 border-accent/20">
        <div className="flex gap-3">
          <AlertCircle size={16} className="text-accent shrink-0 mt-0.5" />
          <div className="text-xs text-muted space-y-1">
            <p className="font-medium text-primary">How rules work</p>
            <p>Higher priority rules run first. Rules are matched in order and all matching rules execute unless
               conditions are exclusive. Use <strong>keyword_match</strong> for specific triggers,
               <strong> message_received</strong> for all incoming messages.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
