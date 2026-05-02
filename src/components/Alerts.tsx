'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, DollarSign, TrendingDown, AlertTriangle, Settings, CheckCheck, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  SUREBET: { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ODDS_DROP: { icon: TrendingDown, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  LIMIT_REACHED: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ACCOUNT_FLAGGED: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  SYSTEM: { icon: Settings, color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

const defaultAlerts: Alert[] = [
  { id: '1', type: 'SUREBET', title: 'High-Value Surebet Detected', message: 'Man City vs Arsenal — 4.2% ROI across Bet365 and Pinnacle. Act quickly, expires in 12 minutes.', isRead: false, createdAt: new Date(Date.now() - 120000).toISOString() },
  { id: '2', type: 'ODDS_DROP', title: 'Significant Odds Movement', message: 'Lakers vs Celtics moneyline odds dropped 15% at DraftKings. New surebet opportunity may be forming.', isRead: false, createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: '3', type: 'SYSTEM', title: 'Scan Complete', message: 'Full market scan completed. Found 23 surebet opportunities across 5 sports and 12 bookmakers.', isRead: true, createdAt: new Date(Date.now() - 600000).toISOString() },
  { id: '4', type: 'LIMIT_REACHED', title: 'Stake Limit Warning', message: 'Bet365 stake limit approaching for this market. Consider reducing position size.', isRead: true, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: '5', type: 'SUREBET', title: 'Auto-Bet Executed', message: 'Successfully placed bets on Djokovic vs Alcaraz. Total stake: $200, Expected ROI: 5.8%.', isRead: true, createdAt: new Date(Date.now() - 1200000).toISOString() },
];

export default function Alerts() {
  const { user } = useAppStore();
  const [alerts, setAlerts] = useState<Alert[]>(defaultAlerts);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter(a => a.type === filter);
  const unreadCount = alerts.filter(a => !a.isRead).length;

  const markAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-gray-400 text-sm mt-1">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {['all', 'SUREBET', 'ODDS_DROP', 'SYSTEM'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}>
                {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-emerald-400 hover:bg-emerald-500/10 transition-colors">
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredAlerts.map((alert) => {
            const config = typeConfig[alert.type] || typeConfig.SYSTEM;
            const Icon = config.icon;
            const isExpanded = expandedId === alert.id;

            return (
              <motion.div key={alert.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`rounded-xl border transition-all ${alert.isRead ? 'bg-[#12121a]/50 border-white/5' : 'bg-[#12121a] border-emerald-500/20'}`}>
                <button onClick={() => toggleExpand(alert.id)} className="w-full flex items-start gap-3 p-4 text-left">
                  <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${alert.isRead ? 'text-gray-300' : 'text-white'}`}>{alert.title}</span>
                      {!alert.isRead && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(alert.createdAt).toLocaleString()}</p>
                    {!isExpanded && <p className="text-xs text-gray-400 mt-1 truncate">{alert.message}</p>}
                  </div>
                  <div className="shrink-0 text-gray-600">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pl-[68px]">
                        <p className="text-sm text-gray-400 leading-relaxed">{alert.message}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Bell className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm">No alerts matching your filter</p>
        </div>
      )}
    </div>
  );
}
