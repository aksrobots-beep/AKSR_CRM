import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Search, RefreshCw } from 'lucide-react';

type MessageLogItem = {
  id: string;
  channel: 'email' | 'push';
  status: 'sent' | 'failed' | 'skipped';
  eventType?: string;
  userId?: string;
  toEmail?: string;
  ccEmail?: string;
  title?: string;
  subject?: string;
  message?: string;
  link?: string;
  error?: string;
  createdAt: string;
};

export function MessageLogs() {
  const { user } = useAuthStore();
  const [channel, setChannel] = useState<'all' | 'email' | 'push'>('all');
  const [status, setStatus] = useState<'all' | 'sent' | 'failed' | 'skipped'>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MessageLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canView = useMemo(() => user?.role === 'admin' || user?.role === 'ceo', [user?.role]);

  const load = async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMessageLogs({
        channel: channel === 'all' ? undefined : channel,
        status: status === 'all' ? undefined : status,
        q: q.trim() || undefined,
        limit: 100,
        offset: 0,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load logs');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, channel, status]);

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-neutral-900">Message Logs</h1>
        <p className="text-sm text-neutral-600 mt-2">You don’t have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Message Logs</h1>
          <p className="text-sm text-neutral-600">Email + Push send history (latest first). Total: {total}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn btn-secondary flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input pl-9 w-full"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, title, subject, error..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
          />
        </div>

        <select className="input w-[160px]" value={channel} onChange={(e) => setChannel(e.target.value as any)}>
          <option value="all">All channels</option>
          <option value="email">Email</option>
          <option value="push">Push</option>
        </select>

        <select className="input w-[160px]" value={status} onChange={(e) => setStatus(e.target.value as any)}>
          <option value="all">All status</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>

        <button type="button" onClick={() => void load()} className="btn btn-primary" disabled={loading}>
          Search
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-danger-50 text-danger-700 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="text-left font-medium px-4 py-3">Time</th>
                <th className="text-left font-medium px-4 py-3">Channel</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3">To</th>
                <th className="text-left font-medium px-4 py-3">Title / Subject</th>
                <th className="text-left font-medium px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-neutral-500">
                    {loading ? 'Loading...' : 'No logs found.'}
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-700">{new Date(it.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`badge ${it.channel === 'email' ? 'badge-neutral' : 'badge-primary'}`}>{it.channel}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`badge ${
                          it.status === 'sent'
                            ? 'badge-success'
                            : it.status === 'failed'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}
                      >
                        {it.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700 max-w-[260px] truncate" title={it.toEmail || ''}>
                      {it.toEmail || (it.channel === 'push' ? it.userId || '-' : '-')}
                    </td>
                    <td className="px-4 py-3 text-neutral-800 max-w-[360px] truncate" title={(it.subject || it.title || '')}>
                      {it.subject || it.title || '-'}
                    </td>
                    <td className="px-4 py-3 text-danger-700 max-w-[320px] truncate" title={it.error || ''}>
                      {it.error || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

