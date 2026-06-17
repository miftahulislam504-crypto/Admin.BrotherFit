'use client';

import { useEffect, useState } from 'react';
import { Users, Search } from 'lucide-react';
import { getCustomers } from '@/services/adminService';
import { Skeleton, EmptyState } from '@/components/ui/Spinner';
import { formatPrice, formatDate } from '@/lib/utils';
import type { Customer } from '@/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    getCustomers(50).then(data => { setCustomers(data); setLoading(false); });
  }, []);

  const filtered = customers.filter(c =>
    (c.name?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
    (c.email?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  );

  return (
    <div className="space-y-4 max-w-5xl">

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="input-field pl-9"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg/40">
                {['Customer','Email','Phone','Orders','Joined'].map(h => (
                  <th key={h} className="tbl-head tbl-cell text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_,i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(5)].map((_,j) => (
                      <td key={j} className="tbl-cell"><Skeleton className="h-4 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10">
                    <EmptyState icon={Users} title="No customers found" />
                  </td>
                </tr>
              ) : (
                filtered.map(customer => (
                  <tr key={customer.uid} className="tbl-row">
                    <td className="tbl-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-primary">
                            {customer.name?.charAt(0)?.toUpperCase() ?? '?'}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-text">{customer.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="tbl-cell text-sm text-muted">{customer.email ?? '—'}</td>
                    <td className="tbl-cell text-sm text-muted">{customer.phone ?? '—'}</td>
                    <td className="tbl-cell text-sm text-muted">{customer.orderCount ?? '—'}</td>
                    <td className="tbl-cell text-xs text-muted whitespace-nowrap">
                      {customer.createdAt ? formatDate(new Date(customer.createdAt as unknown as string)) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <p className="px-4 py-3 border-t border-border text-xs text-muted">
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
