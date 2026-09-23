import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../../types';
import { 
  Activity, 
  RefreshCw, 
  Trash2, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Download, 
  MessageSquare, 
  Globe, 
  User, 
  Clock 
} from 'lucide-react';

export const AuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.warn('Failed to fetch audit logs', e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        setFeedback('Audit activity logs cleared.');
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      setFeedback('Failed to clear logs.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    if (filterSource !== 'all' && log.source !== filterSource) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUser = log.userId?.toLowerCase().includes(q);
      const matchName = log.username?.toLowerCase().includes(q);
      const matchService = log.service?.toLowerCase().includes(q);
      const matchQuery = log.query?.toLowerCase().includes(q);
      return matchUser || matchName || matchService || matchQuery;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Live Query Audit Log & Activity Feed</h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {logs.length} Total Logs
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time tracking of all lookup commands and searches initiated across Telegram Groups, Telegram DMs, and Web Client.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              autoRefresh 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>Auto-Refresh (4s): {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setLoading(true); fetchLogs().then(() => setLoading(false)); }}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by User ID, Telegram @username, service, or query text..."
            className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs pl-9 pr-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white text-xs px-3 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none cursor-pointer w-full sm:w-auto"
          >
            <option value="all">All Sources (Group, DM, Web)</option>
            <option value="telegram_group">Telegram Official Group</option>
            <option value="telegram_dm">Telegram Private DM</option>
            <option value="web">Web Browser Lookup</option>
          </select>
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <Activity className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm font-medium">No activity log records found</p>
            <p className="text-xs text-slate-600">
              {searchQuery || filterSource !== 'all' 
                ? 'Try resetting the filters or search query.' 
                : 'Run any vehicle, voter, or mobile query in Telegram or Web to see live logs.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Target / Query</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px] flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{dateStr}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.source === 'telegram_group' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <MessageSquare className="w-2.5 h-2.5" />
                            Group
                          </span>
                        )}
                        {log.source === 'telegram_dm' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            <User className="w-2.5 h-2.5" />
                            Private DM
                          </span>
                        )}
                        {log.source === 'web' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Globe className="w-2.5 h-2.5" />
                            Web
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-white text-xs">
                          {log.username ? `@${log.username}` : `ID: ${log.userId}`}
                        </div>
                        {log.username && (
                          <div className="text-[10px] text-slate-500">ID: {log.userId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-[11px] font-semibold border border-slate-700 uppercase">
                          {log.service}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-amber-300 font-bold">
                        {log.query || '(empty)'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
