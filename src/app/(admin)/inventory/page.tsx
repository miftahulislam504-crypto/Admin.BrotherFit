'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Search, Boxes, AlertTriangle, Check, X } from 'lucide-react';
import { getAllInventory, adjustStock, type InventoryRow } from '@/services/inventoryService';
import { Skeleton, EmptyState, Badge } from '@/components/ui/Spinner';
import { cn, LOW_STOCK_THRESHOLD } from '@/lib/utils';
import toast from 'react-hot-toast';

type Filter = 'all' | 'low' | 'out';

export default function InventoryPage() {
  const [rows,    setRows]    = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(0);

  useEffect(() => {
    getAllInventory().then(data => { setRows(data); setLoading(false); });
  }, []);

  const filtered = rows.filter(r => {
    const matchesSearch =
      r.productName.toLowerCase().includes(search.toLowerCase()) ||
      r.productSku.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'low' ? r.stock > 0 && r.stock <= LOW_STOCK_THRESHOLD :
      r.stock === 0;
    return matchesSearch && matchesFilter;
  });

  const counts = {
    all: rows.length,
    low: rows.filter(r => r.stock > 0 && r.stock <= LOW_STOCK_THRESHOLD).length,
    out: rows.filter(r => r.stock === 0).length,
  };

  const startEdit = (row: InventoryRow) => { setEditingId(row.id); setEditValue(row.stock); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    try {
      await adjustStock(id, editValue);
      setRows(prev => prev.map(r => r.id === id ? { ...r, stock: editValue } : r));
      toast.success('Stock updated');
    } catch { toast.error('Failed to update stock'); }
    setEditingId(null);
  };

  return (
    <div className="space-y-4 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search product or SKU..."
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          { key: 'all' as Filter, label: 'All Variants' },
          { key: 'low' as Filter, label: 'Low Stock' },
          { key: 'out' as Filter, label: 'Out of Stock' },
        ]).map(t => (
          <button
            key={t.key} onClick={() => setFilter(t.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all',
              filter === t.key ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-muted hover:border-accent'
            )}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-bg/40">
                {['Product','SKU','Size','Color','Stock','Reserved','Sold','Status','Action'].map(h => (
                  <th key={h} className="tbl-head tbl-cell text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_,i) => (
                  <tr key={i} className="border-b border-border">
                    {[...Array(9)].map((_,j) => <td key={j} className="tbl-cell"><Skeleton className="h-4 rounded" /></td>)}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-10"><EmptyState icon={Boxes} title="No variants found" /></td></tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id} className="tbl-row">
                    <td className="tbl-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-9 h-11 rounded-lg overflow-hidden bg-bg flex-shrink-0">
                          {row.productImage && <Image src={row.productImage} alt="" fill className="object-cover" sizes="36px" unoptimized />}
                        </div>
                        <span className="text-sm font-medium text-text clamp-1">{row.productName}</span>
                      </div>
                    </td>
                    <td className="tbl-cell font-mono text-xs text-muted">{row.productSku}</td>
                    <td className="tbl-cell font-medium">{row.size}</td>
                    <td className="tbl-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded-full border border-border" style={{ background: row.colorHex || '#ccc' }} />
                        {row.color}
                      </div>
                    </td>
                    <td className="tbl-cell">
                      {editingId === row.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min="0" value={editValue}
                            onChange={e => setEditValue(parseInt(e.target.value) || 0)}
                            className="input-field w-16 py-1 text-center"
                            autoFocus
                          />
                          <button onClick={() => saveEdit(row.id)} className="btn-ghost p-1 text-success hover:bg-success/10"><Check size={13} /></button>
                          <button onClick={cancelEdit} className="btn-ghost p-1 hover:text-error hover:bg-error/10"><X size={13} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          className={cn(
                            'font-mono font-semibold text-sm px-2 py-1 rounded-lg hover:bg-bg transition-colors',
                            row.stock === 0 ? 'text-error' : row.stock <= LOW_STOCK_THRESHOLD ? 'text-warning' : 'text-text'
                          )}
                        >
                          {row.stock}
                        </button>
                      )}
                    </td>
                    <td className="tbl-cell text-muted text-sm">{row.reserved}</td>
                    <td className="tbl-cell text-muted text-sm">{row.sold}</td>
                    <td className="tbl-cell">
                      {row.stock === 0 ? (
                        <Badge variant="error">Out</Badge>
                      ) : row.stock <= LOW_STOCK_THRESHOLD ? (
                        <Badge variant="warning"><AlertTriangle size={10} className="mr-1" />Low</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                    <td className="tbl-cell">
                      {editingId !== row.id && (
                        <button onClick={() => startEdit(row)} className="btn-outline py-1 px-2.5 text-xs">
                          Adjust
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <p className="px-4 py-3 border-t border-border text-xs text-muted">
            {filtered.length} variant{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
