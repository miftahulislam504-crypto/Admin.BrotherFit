'use client';

// src/app/(admin)/automation/builder/page.tsx
// BrotherFit Admin — Rule Builder

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, ArrowLeft, Save, Zap } from 'lucide-react';
import {
  createRule, updateRule, getRules,
  type AutoRule, type AutoAction, type Platform, type TriggerType,
} from '@/services/automationService';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ── Action templates ──────────────────────────────────────
const ACTION_TEMPLATES: { label: string; value: AutoAction['type']; icon: string }[] = [
  { label: 'Send Message',   value: 'send_message',  icon: '💬' },
  { label: 'Add Tag',        value: 'add_tag',        icon: '🏷️' },
  { label: 'Remove Tag',     value: 'remove_tag',     icon: '✂️' },
  { label: 'Update Status',  value: 'update_status',  icon: '📌' },
  { label: 'Create Lead',    value: 'create_lead',    icon: '👤' },
  { label: 'Notify Admin',   value: 'notify_admin',   icon: '🔔' },
];

const PLATFORMS: { label: string; value: Platform }[] = [
  { label: 'All Platforms', value: 'all'       },
  { label: 'Facebook',      value: 'facebook'  },
  { label: 'Instagram',     value: 'instagram' },
  { label: 'WhatsApp',      value: 'whatsapp'  },
];

const TRIGGERS: { label: string; value: TriggerType; desc: string }[] = [
  { value: 'message_received', label: 'Any Message',     desc: 'Fires on every incoming message' },
  { value: 'keyword_match',    label: 'Keyword Match',   desc: 'Fires when keywords are found'   },
  { value: 'new_lead',         label: 'New Lead',        desc: 'Fires when a new lead is created'},
  { value: 'order_placed',     label: 'Order Placed',    desc: 'Fires when an order is placed'   },
];

// ── Action Editor ─────────────────────────────────────────
function ActionEditor({
  action, index, onChange, onRemove,
}: {
  action: AutoAction; index: number;
  onChange: (i: number, a: AutoAction) => void;
  onRemove: (i: number) => void;
}) {
  const t = ACTION_TEMPLATES.find(t => t.value === action.type);

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-bg/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{t?.icon}</span>
          <span className="text-sm font-medium text-primary">Action {index + 1}</span>
        </div>
        <button onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Action type */}
      <select
        value={action.type}
        onChange={e => onChange(index, { type: e.target.value as AutoAction['type'] })}
        className="input-field text-sm"
      >
        {ACTION_TEMPLATES.map(t => (
          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
        ))}
      </select>

      {/* Dynamic fields */}
      {action.type === 'send_message' && (
        <textarea
          value={action.message ?? ''}
          onChange={e => onChange(index, { ...action, message: e.target.value })}
          placeholder="Message to send... Use {{name}} for contact name"
          rows={3}
          className="input-field text-sm resize-none"
        />
      )}

      {(action.type === 'add_tag' || action.type === 'remove_tag') && (
        <input
          value={action.tag ?? ''}
          onChange={e => onChange(index, { ...action, tag: e.target.value })}
          placeholder="Tag name (e.g. price_inquiry)"
          className="input-field text-sm"
        />
      )}

      {action.type === 'update_status' && (
        <select
          value={action.status ?? 'lead'}
          onChange={e => onChange(index, { ...action, status: e.target.value as any })}
          className="input-field text-sm"
        >
          <option value="new">New</option>
          <option value="lead">Lead</option>
          <option value="customer">Customer</option>
          <option value="vip">VIP</option>
        </select>
      )}

      {action.type === 'create_lead' && (
        <input
          value={action.interest ?? ''}
          onChange={e => onChange(index, { ...action, interest: e.target.value })}
          placeholder="Interest (e.g. product_pricing)"
          className="input-field text-sm"
        />
      )}

      {action.type === 'notify_admin' && (
        <input
          value={action.message ?? ''}
          onChange={e => onChange(index, { ...action, message: e.target.value })}
          placeholder="Notification message..."
          className="input-field text-sm"
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function RuleBuilderPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const editId       = searchParams.get('edit');

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    name: string; description: string; platform: Platform;
    triggerType: TriggerType; keywords: string; priority: number;
    delayMinutes: number; runOncePerContact: boolean; isActive: boolean;
    actions: AutoAction[];
  }>({
    name: '', description: '', platform: 'all',
    triggerType: 'keyword_match', keywords: '',
    priority: 5, delayMinutes: 0,
    runOncePerContact: false, isActive: true,
    actions: [{ type: 'send_message', message: '' }],
  });

  // Load existing rule for edit
  useEffect(() => {
    if (!editId) return;
    getRules().then(rules => {
      const rule = rules.find(r => r.id === editId);
      if (!rule) return;
      setForm({
        name: rule.name, description: rule.description,
        platform: rule.platform, triggerType: rule.triggerType,
        keywords: rule.conditions?.keywords?.join(', ') ?? rule.conditions?.keyword ?? '',
        priority: rule.priority, delayMinutes: rule.delayMinutes,
        runOncePerContact: rule.runOncePerContact, isActive: rule.isActive,
        actions: rule.actions,
      });
    });
  }, [editId]);

  const updateForm = (key: string, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const addAction = () =>
    setForm(prev => ({ ...prev, actions: [...prev.actions, { type: 'send_message', message: '' }] }));

  const updateAction = (i: number, action: AutoAction) =>
    setForm(prev => ({ ...prev, actions: prev.actions.map((a, idx) => idx === i ? action : a) }));

  const removeAction = (i: number) =>
    setForm(prev => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Rule name required'); return; }
    if (form.actions.length === 0) { toast.error('Add at least one action'); return; }

    setSaving(true);
    try {
      const keywords = form.keywords
        .split(',').map(k => k.trim()).filter(Boolean);

      const ruleData: Omit<AutoRule, 'id' | 'createdAt'> = {
        name: form.name.trim(),
        description: form.description.trim(),
        platform: form.platform,
        triggerType: form.triggerType,
        conditions: form.triggerType === 'keyword_match' && keywords.length > 0
          ? { keywords } : null,
        actions: form.actions,
        priority: form.priority,
        delayMinutes: form.delayMinutes,
        runOncePerContact: form.runOncePerContact,
        isActive: form.isActive,
      };

      if (editId) {
        await updateRule(editId, ruleData);
        toast.success('Rule updated!');
      } else {
        await createRule(ruleData);
        toast.success('Rule created!');
      }
      router.push('/automation');
    } catch {
      toast.error('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/automation')}
          className="p-2 rounded-xl hover:bg-border transition-colors text-muted hover:text-primary">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="font-serif text-lg text-primary">
            {editId ? 'Edit Rule' : 'New Rule'}
          </h2>
          <p className="text-xs text-muted">Configure trigger, conditions, and actions</p>
        </div>
      </div>

      {/* ── Basic Info ──────────────────────────────────── */}
      <div className="card card-inner space-y-4">
        <h3 className="font-medium text-sm text-primary flex items-center gap-2">
          <Zap size={14} className="text-accent" /> Basic Info
        </h3>

        <div className="space-y-3">
          <div>
            <label className="label-field">Rule Name *</label>
            <input value={form.name} onChange={e => updateForm('name', e.target.value)}
              placeholder="e.g. Price Inquiry Auto Reply"
              className="input-field" />
          </div>
          <div>
            <label className="label-field">Description</label>
            <input value={form.description} onChange={e => updateForm('description', e.target.value)}
              placeholder="What this rule does..."
              className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Priority (higher = first)</label>
              <input type="number" min={0} max={100}
                value={form.priority} onChange={e => updateForm('priority', +e.target.value)}
                className="input-field" />
            </div>
            <div>
              <label className="label-field">Delay (minutes)</label>
              <input type="number" min={0} max={1440}
                value={form.delayMinutes} onChange={e => updateForm('delayMinutes', +e.target.value)}
                className="input-field" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Trigger & Conditions ────────────────────────── */}
      <div className="card card-inner space-y-4">
        <h3 className="font-medium text-sm text-primary">⚡ Trigger & Conditions</h3>

        <div>
          <label className="label-field">Platform</label>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map(p => (
              <button key={p.value} onClick={() => updateForm('platform', p.value)}
                className={cn(
                  'py-2 px-3 rounded-xl text-sm font-medium border transition-all',
                  form.platform === p.value
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted hover:border-accent',
                )}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label-field">Trigger Type</label>
          <div className="space-y-2">
            {TRIGGERS.map(t => (
              <button key={t.value} onClick={() => updateForm('triggerType', t.value)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                  form.triggerType === t.value
                    ? 'bg-accent/10 border-accent text-primary'
                    : 'border-border text-muted hover:border-accent/50',
                )}>
                <div className={cn('w-2 h-2 rounded-full shrink-0',
                  form.triggerType === t.value ? 'bg-accent' : 'bg-border')} />
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-[11px] opacity-70">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {form.triggerType === 'keyword_match' && (
          <div>
            <label className="label-field">Keywords (comma separated)</label>
            <input value={form.keywords}
              onChange={e => updateForm('keywords', e.target.value)}
              placeholder="price, দাম, কত, cost, rate"
              className="input-field" />
            <p className="text-[11px] text-muted mt-1">
              Message contains ANY of these → rule fires
            </p>
          </div>
        )}

        {/* Options */}
        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.runOncePerContact}
              onChange={e => updateForm('runOncePerContact', e.target.checked)}
              className="rounded border-border" />
            <span className="text-sm text-muted">Run only once per contact</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={e => updateForm('isActive', e.target.checked)}
              className="rounded border-border" />
            <span className="text-sm text-muted">Active</span>
          </label>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────── */}
      <div className="card card-inner space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-primary">🎯 Actions</h3>
          <button onClick={addAction} className="btn-ghost text-xs py-1.5 px-3">
            <Plus size={12} /> Add Action
          </button>
        </div>

        <div className="space-y-3">
          {form.actions.map((action, i) => (
            <ActionEditor key={i} action={action} index={i}
              onChange={updateAction} onRemove={removeAction} />
          ))}
          {form.actions.length === 0 && (
            <div className="text-center py-6 text-muted text-sm border-2 border-dashed
                            border-border rounded-xl">
              No actions yet — add one above
            </div>
          )}
        </div>
      </div>

      {/* ── Save ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-6">
        <button onClick={() => router.push('/automation')} className="btn-outline flex-1">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
          {saving
            ? 'Saving…'
            : <><Save size={14} /> {editId ? 'Update Rule' : 'Save Rule'}</>
          }
        </button>
      </div>
    </div>
  );
}
