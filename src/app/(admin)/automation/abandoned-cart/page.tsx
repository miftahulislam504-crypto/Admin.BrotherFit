'use client';

// src/app/(admin)/automation/abandoned-cart/page.tsx
// BrotherFit Admin — Abandoned Cart Reminder Settings

import { useEffect, useState } from 'react';
import {
  ShoppingCart, Settings2, Send, RefreshCw, CheckCircle,
  Clock, TrendingUp, AlertTriangle, Play, ToggleLeft, ToggleRight,
  Zap, Users, DollarSign,
} from 'lucide-react';
import {
  getAbandonedCarts, getCartStats, getSettings, saveSettings,
  DEFAULT_REMINDER_MSG, type AbandonedCart, type CartReminderSettings,
} from '@/services/abandonedCartService';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ── Stat card ─────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string | number;
  sub?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="card card-inner flex items-start gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-semibold text-primary">{value}</p>
        <p className="text-[11px] text-muted">{label}</p>
        {sub && <p className="text-[10px] text-accent mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Cart row ──────────────────────────────────────────────
function CartRow({ cart }: { cart: AbandonedCart }) {
  const statusMap = {
    active:    { label: 'Abandoned', color: 'bg-red-50 text-red-600 border-red-200'     },
    reminded:  { label: 'Reminded',  color: 'bg-blue-50 text-blue-600 border-blue-200'  },
    converted: { label: 'Converted', color: 'bg-green-50 text-green-600 border-green-200'},
    expired:   { label: 'Expired',   color: 'bg-gray-50 text-gray-500 border-gray-200'  },
  };
  const st = statusMap[cart.status];
  const total = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="flex items-center gap-4 p-4 border-b border-border last:border-0
                    hover:bg-bg/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-primary">
            {cart.userName ?? 'Unknown'}
          </span>
          <span className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full border',
            st.color
          )}>
            {st.label}
          </span>
          {cart.reminderCount > 0 && (
            <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
              {cart.reminderCount}× reminded
            </span>
          )}
        </div>
        <p className="text-xs text-muted">
          {cart.items.length} item{cart.items.length > 1 ? 's' : ''} ·{' '}
          {cart.items.map(i => `${i.productName} (${i.size})`).join(', ')}
        </p>
        {cart.phone && (
          <p className="text-[11px] text-muted mt-0.5">📱 {cart.phone}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-sm text-primary">৳{total}</p>
        <p className="text-[10px] text-muted mt-0.5">
          {new Date(cart.lastUpdatedAt).toLocaleDateString('en-BD')}
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function AbandonedCartPage() {
  const [tab,      setTab]      = useState<'overview'|'carts'|'settings'>('overview');
  const [carts,    setCarts]    = useState<AbandonedCart[]>([]);
  const [stats,    setStats]    = useState({ active: 0, reminded: 0, converted: 0, total: 0, recoveredRevenue: 0, conversionRate: 0 });
  const [settings, setSettings] = useState<CartReminderSettings>({
    id: '', isEnabled: true, delayHours: 2,
    maxReminders: 2, reminderGapHours: 24,
    useAI: true, customMessage: DEFAULT_REMINDER_MSG,
  });
  const [loading,   setLoading]   = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [running,   setRunning]   = useState(false);
  const [cartFilter, setCartFilter] = useState<AbandonedCart['status'] | 'all'>('all');

  const load = async () => {
    setLoading(true);
    const [s, st, cfg] = await Promise.all([
      getCartStats(),
      getAbandonedCarts(),
      getSettings(),
    ]);
    setStats(s);
    setCarts(st);
    if (cfg) setSettings(cfg);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaveSettings = async () => {
    setSavingCfg(true);
    try {
      const { id, ...rest } = settings;
      await saveSettings(rest);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingCfg(false);
    }
  };

  const handleRunNow = async () => {
    if (!confirm('Manually trigger abandoned cart reminders now?')) return;
    setRunning(true);
    try {
      const res = await fetch('/api/cron/abandoned-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: process.env.NEXT_PUBLIC_CRON_SECRET }),
      });
      const data = await res.json();
      toast.success(`Sent ${data.sent} reminders (${data.errors} errors)`);
      await load();
    } catch {
      toast.error('Failed to run cron');
    } finally {
      setRunning(false);
    }
  };

  const filteredCarts = cartFilter === 'all'
    ? carts
    : carts.filter(c => c.status === cartFilter);

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-lg text-primary">Abandoned Cart</h2>
          <p className="text-xs text-muted mt-0.5">
            Auto-remind customers who left items in their cart
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="btn-ghost text-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleRunNow} disabled={running}
            className="btn-primary text-sm">
            {running
              ? <><RefreshCw size={14} className="animate-spin" /> Running…</>
              : <><Play size={14} /> Run Now</>
            }
          </button>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Abandoned Carts" value={stats.active}
          icon={<ShoppingCart size={18} className="text-red-600" />}
          color="bg-red-50" />
        <StatCard label="Reminders Sent" value={stats.reminded}
          icon={<Send size={18} className="text-blue-600" />}
          color="bg-blue-50" />
        <StatCard label="Recovered" value={stats.converted}
          sub={`৳${stats.recoveredRevenue.toLocaleString()}`}
          icon={<CheckCircle size={18} className="text-green-600" />}
          color="bg-green-50" />
      </div>

      {/* Recovery rate bar */}
      {stats.total > 0 && (
        <div className="card card-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary">Recovery Rate</span>
            <span className="text-sm font-bold text-accent">{stats.conversionRate}%</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${stats.conversionRate}%` }}
            />
          </div>
          <p className="text-[11px] text-muted mt-1.5">
            {stats.converted} out of {stats.reminded + stats.converted} reminded carts converted
          </p>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="flex gap-1 bg-bg rounded-xl p-1 border border-border">
        {(['overview', 'carts', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all',
              tab === t ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-primary',
            )}>
            {t === 'overview' ? '📊 Overview'
              : t === 'carts' ? `🛒 Carts (${stats.active})`
              : '⚙️ Settings'}
          </button>
        ))}
      </div>

      {/* ── Tab: Carts list ──────────────────────────────── */}
      {tab === 'carts' && (
        <div className="card overflow-hidden">
          {/* Filter */}
          <div className="flex gap-1 p-3 border-b border-border">
            {(['all', 'active', 'reminded', 'converted'] as const).map(f => (
              <button key={f} onClick={() => setCartFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                  cartFilter === f
                    ? 'bg-primary text-white'
                    : 'text-muted hover:bg-border',
                )}>
                {f} {f === 'all' ? `(${carts.length})` : `(${carts.filter(c => c.status === f).length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted text-sm">Loading carts…</div>
          ) : filteredCarts.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted">
              <ShoppingCart size={36} className="mb-3 opacity-20" />
              <p className="text-sm">No abandoned carts found</p>
            </div>
          ) : (
            filteredCarts.map(c => <CartRow key={c.id} cart={c} />)
          )}
        </div>
      )}

      {/* ── Tab: Overview ────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* How it works */}
          <div className="card card-inner space-y-3">
            <h3 className="font-medium text-sm text-primary">⚙️ How It Works</h3>
            <div className="space-y-2">
              {[
                { step: '1', text: `Customer adds to cart but doesn't checkout` },
                { step: '2', text: `System waits ${settings.delayHours} hours` },
                { step: '3', text: `WhatsApp reminder sent${settings.useAI ? ' (AI-generated)' : ''}` },
                { step: '4', text: `If no response, remind again after ${settings.reminderGapHours} hours` },
                { step: '5', text: `Max ${settings.maxReminders} reminders per cart` },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px]
                                   font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {s.step}
                  </span>
                  <p className="text-sm text-muted">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Setup checklist */}
          <div className="card card-inner space-y-3">
            <h3 className="font-medium text-sm text-primary">✅ Setup Checklist</h3>
            <div className="space-y-2">
              {[
                { label: 'Cart tracker in BrotherFit app',      done: true  },
                { label: 'GEMINI_API_KEY in .env.local',        done: false },
                { label: 'CRON_SECRET in .env.local',           done: false },
                { label: 'vercel.json cron schedule configured', done: false },
                { label: 'WhatsApp API connected',              done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={cn(
                    'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                    item.done ? 'bg-green-100' : 'bg-border',
                  )}>
                    {item.done
                      ? <CheckCircle size={10} className="text-green-600" />
                      : <span className="w-1.5 h-1.5 rounded-full bg-muted/50" />}
                  </div>
                  <span className={cn('text-sm', item.done ? 'text-primary' : 'text-muted')}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="card card-inner bg-amber-50 border-amber-200">
            <div className="flex gap-2.5">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <strong>WhatsApp 24-hour rule:</strong> Reminder শুধু তখনই send হবে যখন customer
                আগে 24 ঘণ্টার মধ্যে message করেছে। তাই reminder এর সাথে WhatsApp contact থাকা দরকার।
                Alternatively, approved template message use করো।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Settings ────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="card card-inner space-y-5">

          {/* Enable toggle */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <p className="font-medium text-sm text-primary">Enable Reminders</p>
              <p className="text-xs text-muted">Automatically send cart reminders</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, isEnabled: !p.isEnabled }))}>
              {settings.isEnabled
                ? <ToggleRight size={28} className="text-green-500" />
                : <ToggleLeft  size={28} className="text-muted"     />}
            </button>
          </div>

          {/* AI toggle */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <p className="font-medium text-sm text-primary flex items-center gap-1.5">
                <Zap size={13} className="text-accent" /> AI-Generated Messages
              </p>
              <p className="text-xs text-muted">Use Gemini to personalize each reminder</p>
            </div>
            <button onClick={() => setSettings(p => ({ ...p, useAI: !p.useAI }))}>
              {settings.useAI
                ? <ToggleRight size={28} className="text-accent" />
                : <ToggleLeft  size={28} className="text-muted"  />}
            </button>
          </div>

          {/* Timing settings */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-field">Wait Before 1st Reminder (hrs)</label>
              <input type="number" min={1} max={72}
                value={settings.delayHours}
                onChange={e => setSettings(p => ({ ...p, delayHours: +e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="label-field">Gap Between Reminders (hrs)</label>
              <input type="number" min={1} max={168}
                value={settings.reminderGapHours}
                onChange={e => setSettings(p => ({ ...p, reminderGapHours: +e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="label-field">Max Reminders Per Cart</label>
              <input type="number" min={1} max={5}
                value={settings.maxReminders}
                onChange={e => setSettings(p => ({ ...p, maxReminders: +e.target.value }))}
                className="input-field" />
            </div>
          </div>

          {/* Custom message */}
          {!settings.useAI && (
            <div>
              <label className="label-field">Custom Reminder Message</label>
              <p className="text-[11px] text-muted mb-1.5">
                Variables: <code className="bg-bg px-1 rounded">{'{{name}}'}</code>{' '}
                <code className="bg-bg px-1 rounded">{'{{total}}'}</code>
              </p>
              <textarea
                value={settings.customMessage}
                onChange={e => setSettings(p => ({ ...p, customMessage: e.target.value }))}
                rows={6}
                className="input-field text-sm resize-none font-mono"
              />
            </div>
          )}

          {settings.useAI && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
              <p className="text-sm font-medium text-primary mb-1">
                🤖 AI Message Preview
              </p>
              <p className="text-xs text-muted">
                Gemini will generate a personalized message for each customer based on their
                name, cart items, and total. Each message will be unique and contextual.
              </p>
            </div>
          )}

          <button onClick={handleSaveSettings} disabled={savingCfg}
            className="btn-primary w-full">
            {savingCfg ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
