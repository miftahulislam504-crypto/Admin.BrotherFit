'use client';

import { useEffect, useState } from 'react';
import { getStoreSettings, updateStoreSettings } from '@/services/adminService';
import { Spinner } from '@/components/ui/Spinner';
import type { StoreSettings } from '@/types';
import toast from 'react-hot-toast';

const DEFAULT: StoreSettings = {
  name: 'FashionOS', address: '', email: '', phone: '',
  payment: { bkash: true, nagad: true, cod: true },
  delivery: { dhakaCharge: 2, outsideCharge: 5 },
  reviews:  { autoApprove: false },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    getStoreSettings().then(s => { if (s) setSettings(s); setLoading(false); });
  }, []);

  const update = (path: string, value: unknown) => {
    setSettings(prev => {
      const next = structuredClone(prev);
      const keys = path.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStoreSettings(settings);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  if (loading) return <Spinner size="lg" className="mt-10 mx-auto" />;

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Store Info */}
      <Section title="Store Information">
        <Field label="Store Name">
          <input value={settings.name} onChange={e=>update('name',e.target.value)} className="input-field" />
        </Field>
        <Field label="Email">
          <input type="email" value={settings.email} onChange={e=>update('email',e.target.value)} placeholder="store@fashionos.com" className="input-field" />
        </Field>
        <Field label="Phone">
          <input value={settings.phone??''} onChange={e=>update('phone',e.target.value)} placeholder="01XXXXXXXXX" className="input-field" />
        </Field>
        <Field label="Address">
          <textarea value={settings.address} onChange={e=>update('address',e.target.value)} rows={2} placeholder="Store address" className="input-field resize-none" />
        </Field>
      </Section>

      {/* Payment */}
      <Section title="Payment Methods">
        {(['bkash','nagad','cod'] as const).map(method => (
          <label key={method} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 cursor-pointer">
            <span className="text-sm font-medium text-text capitalize">
              {method === 'cod' ? 'Cash on Delivery' : method === 'bkash' ? 'bKash' : 'Nagad'}
            </span>
            <input
              type="checkbox"
              checked={settings.payment[method]}
              onChange={e=>update(`payment.${method}`, e.target.checked)}
              className="w-4 h-4 rounded"
            />
          </label>
        ))}
      </Section>

      {/* Delivery */}
      <Section title="Delivery Charges (USD)">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dhaka City">
            <input
              type="number" step="0.5" min="0"
              value={settings.delivery.dhakaCharge}
              onChange={e=>update('delivery.dhakaCharge', Number(e.target.value))}
              className="input-field"
            />
          </Field>
          <Field label="Outside Dhaka">
            <input
              type="number" step="0.5" min="0"
              value={settings.delivery.outsideCharge}
              onChange={e=>update('delivery.outsideCharge', Number(e.target.value))}
              className="input-field"
            />
          </Field>
        </div>
      </Section>

      {/* Reviews */}
      <Section title="Review Settings">
        <label className="flex items-center justify-between py-2 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-text">Auto-approve reviews</p>
            <p className="text-xs text-muted">Reviews will be published immediately without moderation</p>
          </div>
          <input
            type="checkbox"
            checked={settings.reviews.autoApprove}
            onChange={e=>update('reviews.autoApprove', e.target.checked)}
            className="w-4 h-4 rounded"
          />
        </label>
      </Section>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving && <Spinner size="sm" className="border-white border-t-transparent" />}
        {saving ? 'Saving…' : 'Save Settings'}
      </button>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-inner space-y-4">
      <h3 className="font-serif text-base text-primary border-b border-border pb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text">{label}</label>
      {children}
    </div>
  );
}
