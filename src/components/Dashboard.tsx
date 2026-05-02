'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Target, Percent, Scan, DollarSign, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAppStore } from '@/lib/store';

const kpiData = [
  { label: 'Total Profit', value: '$4,287', change: '+12.5%', positive: true, icon: DollarSign, color: 'emerald' },
  { label: 'Active Surebets', value: '23', change: 'Live now', positive: true, icon: Target, color: 'blue' },
  { label: 'Win Rate', value: '87.3%', change: '+2.1%', positive: true, icon: Percent, color: 'emerald' },
  { label: "Today's Scans", value: '156', change: '+34', positive: true, icon: Scan, color: 'purple' },
];

const chartData = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    profit: parseFloat(((Math.random() - 0.3) * 400).toFixed(2)),
  };
});

const bookmakerData = [
  { name: 'Bet365', profit: 1240 },
  { name: 'Pinnacle', profit: 980 },
  { name: '1xBet', profit: 870 },
  { name: 'DraftKings', profit: 650 },
  { name: 'FanDuel', profit: 547 },
];

const recentSurebets = [
  { match: 'Man City vs Arsenal', sport: 'Football', profit: '+$42.30', roi: '4.2%', time: '2m ago', status: 'active' },
  { match: 'Lakers vs Celtics', sport: 'Basketball', profit: '+$18.70', roi: '2.8%', time: '5m ago', status: 'active' },
  { match: 'Djokovic vs Alcaraz', sport: 'Tennis', profit: '+$65.10', roi: '6.1%', time: '8m ago', status: 'placed' },
  { match: 'Yankees vs Dodgers', sport: 'Baseball', profit: '+$31.50', roi: '3.4%', time: '12m ago', status: 'won' },
  { match: 'Real Madrid vs Barcelona', sport: 'Football', profit: '+$22.80', roi: '2.1%', time: '15m ago', status: 'won' },
];

export default function Dashboard() {
  const { user } = useAppStore();


  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.name || 'Trader'}</h1>
          <p className="text-gray-400 text-sm mt-1">Here is your performance overview for today.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-300">Live Scanning Active</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-4 rounded-xl bg-[#12121a] border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color === 'emerald' ? 'bg-emerald-500/10' : kpi.color === 'blue' ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color === 'emerald' ? 'text-emerald-400' : kpi.color === 'blue' ? 'text-blue-400' : 'text-purple-400'}`} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium ${kpi.positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.change}
              </span>
            </div>
            <div className="text-2xl font-bold">{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profit Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2 p-6 rounded-xl bg-[#12121a] border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Profit Overview</h3>
              <p className="text-xs text-gray-500 mt-0.5">Last 30 days performance</p>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">+$4,287</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: unknown) => [`$${Number(value).toFixed(2)}`, 'Profit']}
              />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#profitGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Bookmakers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
          <h3 className="font-semibold mb-1">Top Bookmakers</h3>
          <p className="text-xs text-gray-500 mb-6">By total profit this month</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bookmakerData} layout="vertical">
              <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} width={80} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                formatter={(value: unknown) => [`$${value}`, 'Profit']}
              />
              <Bar dataKey="profit" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recent Surebets */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-xl bg-[#12121a] border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Recent Surebets</h3>
            <p className="text-xs text-gray-500 mt-0.5">Latest detected opportunities</p>
          </div>
          <button className="text-xs text-emerald-400 hover:text-emerald-300">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Match</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Sport</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Profit</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">ROI</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Time</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSurebets.map((sb, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-6 py-3 font-medium">{sb.match}</td>
                  <td className="px-6 py-3 text-gray-400">{sb.sport}</td>
                  <td className="px-6 py-3 text-emerald-400 font-medium">{sb.profit}</td>
                  <td className="px-6 py-3 text-gray-300">{sb.roi}</td>
                  <td className="px-6 py-3 text-gray-500">{sb.time}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sb.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                      sb.status === 'placed' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>
                      {sb.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
