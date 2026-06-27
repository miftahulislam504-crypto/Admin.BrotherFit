'use client';

// src/app/(admin)/broadcast/page.tsx
// BrotherFit Admin — Broadcast Messages

import { useEffect, useState } from 'react';
import {
  Send, Plus, Users, MessageCircle, Facebook,
  Instagram, CheckCircle, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import {
  getBroadcasts, createBroadcast, sendBroadcast,
  type BroadcastCampaign,
} from '@/services/automationService';
import { cn, formatDateTime } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Spinner';
import toast from 'react-hot-toast';

// ── Status config ─────────────────────────────────────────
const StatusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  draft:   { icon: <Clock        size={12} />, color: 'bg-gray-50 text-gray-600 border-gray-200',    label: 'Draft'   },
  sending: { icon: <Send         size={12} />, color: 'bg-blue-50 text-blue-600 border-blue-200',    label: 'Sending' },
  sent:    { icon: <CheckCircle  size={12} />, color: 'bg-green-50 text-green-600 border-green-200', label: 'Sent'    },
  failed:  { icon: <XCircle      size={12} />, color: 'bg-red-50 text-red-600 border-red-200',       label: 'Failed'  },
};

const PlatformIcon = ({ p }: { p: string }) => {
  if (p === 'facebook')  return <Facebook  size={14} className="text-blue-500"  />;
  if (p === 'instagram') return <Instagram size={14} className="text-pink-500"  />;
  return <MessageCircle size={14} className="text-green-500" />;
};

// ── New Campaign Modal ────────────────────────────────────
function NewCampaignModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', platform: 'whatsapp' as 'facebook' | 'instagram' | 'whatsapp',
    message: '', targetTags: '',
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (andSend = false) => {
    if (!form.name.trim() || !form.message.trim()) {
      toast.error('Name and message required');
      return;
    }
    setSaving(true);
    try {
      const tags = form.targetTags.split(',').map(t => t.trim()).filter(Boolean);
      const id = await createBroadcast({
        name: form.name, platform: form.platform,
        message: form.message, targetTags: tags,
      });
      if (andSend) {
        toast.loading('Sending broadcast…', { id: 'broadcast' });
        const result = await sendBroadcast(id);
        toast.success(
          `Sent to ${result.success}/${result.total} contacts`, { id: 'broadcast' }
        );
      } else {
        toast.success('Campaign saved as draft');
      }
      onCreated();
      onClose();
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-lg p-6 space-y-4">
        <h3 className="font-serif text-base text-primary">New Broadcast Campaign</h3>

        <div className="space-y-3">
          <div>
            <label className="label-field">Campaign Name *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Eid Sale Announcement"
              className="input-field" />
          </div>

          <div>
            <label className="label-field">Platform *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['facebook', 'instagram', 'whatsapp'] as const).map(pl => (
                <button key={pl} onClick={() => setForm(p => ({ ...p, platform: pl }))}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm transition-all capitalize',
                    form.platform === pl
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-muted hover:border-accent',
                  )}>
                  <PlatformIcon p={pl} />
                  {pl === 'facebook' ? 'FB' : pl === 'instagram' ? 'IG' : 'WA'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Message *</label>
            <textarea value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="🔥 BrotherFit Eid Sale!\n\n৫০% Off সব products এ!\n\nOffer ends: 31 March 2025"
              rows={5} className="input-field resize-none text-sm" />
            <p className="text-[11px] text-muted mt-1">
              {form.message.length} characters
            </p>
          </div>

          <div>
            <label className="label-field">Target Tags (optional)</label>
            <input value={form.targetTags}
              onChange={e => setForm(p => ({ ...p, targetTags: e.target.value }))}
              placeholder="price_inquiry, interested (leave empty for all)"
              className="input-field text-sm" />
            <p className="text-[11px] text-muted mt-1">
              Comma separated. Empty = all contacts on selected platform
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-outline flex-1" disabled={saving}>
            Cancel
          </button>
          <button onClick={() => handleCreate(false)} className="btn-outline flex-1" disabled={saving}>
            Save Draft
          </button>
          <button onClick={() => handleCreate(true)} className="btn-primary flex-1" disabled={saving}>
            <Send size={13} /> {saving ? 'Sending…' : 'Send Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function BroadcastPage() {
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showNew,   setShowNew]   = useState(false);
  const [sending,   setSending]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await getBroadcasts();
    setCampaigns(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSend = async (id: string) => {
    if (!confirm('Send this broadcast now?')) return;
    setSending(id);
    try {
      toast.loading('Sending…', { id: 'send' });
      const result = await sendBroadcast(id);
      toast.success(`Sent to ${result.success}/${result.total} contacts`, { id: 'send' });
      await load();
    } catch {
      toast.error('Broadcast failed', { id: 'send' });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg text-primary">Broadcast</h2>
          <p className="text-xs text-muted mt-0.5">
            Send messages to multiple contacts at once
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm">
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {/* ── Warning ────────────────────────────────────── */}
      <div className="card card-inner bg-amber-50 border-amber-200">
        <div className="flex gap-2.5">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>WhatsApp restriction:</strong> Broadcast only works within 24 hours of customer
            last contact, or with pre-approved templates. Facebook/Instagram has no such restriction
            for pages with messaging permission.
          </p>
        </div>
      </div>

      {/* ── Campaigns List ─────────────────────────────── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <Send size={36} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="text-xs mt-1">Create your first broadcast campaign</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map(campaign => {
              const sc = StatusConfig[campaign.status];
              return (
                <div key={campaign.id} className="p-4 flex items-start gap-4">

                  {/* Platform icon */}
                  <div className="w-9 h-9 rounded-xl bg-bg flex items-center justify-center shrink-0">
                    <PlatformIcon p={campaign.platform} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm text-primary">{campaign.name}</span>
                      <span className={cn(
                        'flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                        sc.color
                      )}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>

                    <p className="text-xs text-muted truncate mb-2">{campaign.message}</p>

                    <div className="flex items-center gap-4 text-[11px] text-muted">
                      {campaign.status === 'sent' && (
                        <>
                          <span className="flex items-center gap-1">
                            <CheckCircle size={10} className="text-green-500" />
                            {campaign.sentCount} sent
                          </span>
                          {campaign.failedCount > 0 && (
                            <span className="flex items-center gap-1">
                              <XCircle size={10} className="text-red-500" />
                              {campaign.failedCount} failed
                            </span>
                          )}
                          <span>
                            <Users size={10} className="inline mr-1" />
                            {campaign.totalCount} total
                          </span>
                        </>
                      )}
                      {campaign.targetTags.length > 0 && (
                        <span>Tags: {campaign.targetTags.join(', ')}</span>
                      )}
                      <span>{formatDateTime(campaign.createdAt)}</span>
                    </div>
                  </div>

                  {/* Send button for drafts */}
                  {campaign.status === 'draft' && (
                    <button
                      onClick={() => handleSend(campaign.id)}
                      disabled={sending === campaign.id}
                      className="btn-primary text-xs px-3 py-2 shrink-0">
                      {sending === campaign.id ? 'Sending…' : <><Send size={12} /> Send</>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showNew && (
        <NewCampaignModal onClose={() => setShowNew(false)} onCreated={load} />
      )}
    </div>
  );
}
