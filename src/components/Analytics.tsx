'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsData {
  summary: {
    totalBets: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
    avgROI: number;
    bestDay: { date: string; profit: number };
    worstDay: { date: string; profit: number };
  };
  profitOverTime: Array<{ date: string; profit: number; cumulative: number }>;
  profitBySport: Array<{ sport: string; profit: number }>;
  profitByBookmaker: Array<{ bookmaker: string; profit: number }>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const PIE_COLORS = ['#10b981', '#ef4444'];

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    fetchAnalytics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/performance?range=${range}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pieData = [
    { name: 'Wins', value: data.summary.wins },
    { name: 'Losses', value: data.summary.losses },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Detailed analysis of your betting performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          {['7d', '30d', '90d'].map(r => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Bets', value: data.summary.totalBets.toString() },
          { label: 'Win Rate', value: `${data.summary.winRate}%` },
          { label: 'Total Profit', value: `$${data.summary.totalProfit.toFixed(2)}`, positive: data.summary.totalProfit > 0 },
          { label: 'Avg ROI', value: `${data.summary.avgROI}%`, positive: data.summary.avgROI > 0 },
          { label: 'Best Day', value: `$${data.summary.bestDay.profit.toFixed(2)}`, positive: true },
          { label: 'Worst Day', value: `$${data.summary.worstDay.profit.toFixed(2)}`, positive: false },
        ].map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-4 rounded-xl bg-[#12121a] border border-white/5">
            <div className="text-xs text-gray-500 mb-1">{m.label}</div>
            <div className={`text-lg font-bold ${m.positive === true ? 'text-emerald-400' : m.positive === false ? 'text-red-400' : 'text-white'}`}>{m.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Profit Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold">Profit Over Time</h3>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><div className="w-3 h-1 bg-emerald-500 rounded" /> Daily</span>
            <span className="flex items-center gap-1"><div className="w-3 h-1 bg-blue-500 rounded" /> Cumulative</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.profitOverTime}>
            <defs>
              <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`]} />
            <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2} fill="url(#cumGrad)" />
            <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#dailyGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Win/Loss Pie */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
          <h3 className="font-semibold mb-4">Win/Loss Ratio</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" stroke="none">
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-emerald-500" /> Wins ({data.summary.wins})</span>
            <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-red-500" /> Losses ({data.summary.losses})</span>
          </div>
        </motion.div>

        {/* Profit by Sport */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
          <h3 className="font-semibold mb-4">Profit by Sport</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.profitBySport}>
              <XAxis dataKey="sport" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'Profit']} />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]} barSize={40}>
                {data.profitBySport.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Profit by Bookmaker */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-2 p-6 rounded-xl bg-[#12121a] border border-white/5">
          <h3 className="font-semibold mb-4">Profit by Bookmaker</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.profitByBookmaker} layout="vertical">
              <XAxis type="number" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="bookmaker" type="category" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} width={90} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'Profit']} />
              <Bar dataKey="profit" radius={[0, 4, 4, 0]} barSize={18}>
                {data.profitByBookmaker.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
