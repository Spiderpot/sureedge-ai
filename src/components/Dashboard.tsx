'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Zap, Shield, DollarSign,
  Activity, Target, Eye, Clock,
} from 'lucide-react';
import LiveActivityFeed from './LiveActivityFeed';
import HotMarkets from './HotMarkets';

interface DashboardStats {
  totalScans:    number;
  arbsFound:     number;
  alertsSent:    number;
  topEdgeScore:  number;
  creditsLeft:   number;
  uptime:        string;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d0d18] border border-white/5 rounded-xl p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-1">{sub}</div>}
    </motion.div>
  );
}

export default function Dashboard() {
  const [stats, setStats]     = useState<DashboardStats>({
    totalScans: 0, arbsFound: 0, alertsSent: 0,
    topEdgeScore: 0, creditsLeft: 0, uptime: '100%',
  });
  const [scanningMsg, setScanningMsg] = useState(0);
  const [pulse, setPulse]     = useState(true);

  const SCANNING_MESSAGES = [
    'Scanning live markets...',
    'Monitoring 247 active events',
    'Tracking sharp line movement',
    'Watching 4 premium bookmakers',
    'Detecting volatility spikes',
    'Comparing Pinnacle vs soft books',
    'Analyzing price divergence...',
    'Hunting market inefficiencies...',
  ];

  useEffect(() => {
    // Cycle scanning messages
    const msgInterval = setInterval(() => {
      setScanningMsg(m => (m + 1) % SCANNING_MESSAGES.length);
    }, 3000);

    // Pulse indicator
    const pulseInterval = setInterval(() => {
      setPulse(p => !p);
    }, 1500);

    return () => {
      clearInterval(msgInterval);
      clearInterval(pulseInterval);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Market Intelligence</h1>
          <p className="text-gray-400 text-sm mt-1">
            AI-powered sharp price divergence detection
          </p>
        </div>

        {/* Live scanning indicator */}
        <div className="flex items-center gap-3 bg-[#0d0d18] border border-emerald-500/20 rounded-xl px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <motion.span
            key={scanningMsg}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-emerald-400 font-medium"
          >
            {SCANNING_MESSAGES[scanningMsg]}
          </motion.span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Target}
          label="4 Bookmakers"
          value="Pinnacle"
          sub="+ 1xBet · Bet365 · 22Bet"
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={Zap}
          label="Alert Threshold"
          value="0.7%"
          sub="YOUR BOOKS"
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          icon={Activity}
          label="Scan Frequency"
          value="12 min"
          sub="11 sports rotating"
          color="bg-orange-500/10 text-orange-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Top Volatility"
          value="Table Tennis"
          sub="Score: 100/100"
          color="bg-red-500/10 text-red-400"
        />
      </div>

      {/* Main content: Activity Feed + Hot Markets side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveActivityFeed />
        <HotMarkets />
      </div>

      {/* Intelligence Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0d0d18] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Sharp Reference</span>
          </div>
          <div className="text-lg font-bold text-white mb-1">Pinnacle</div>
          <div className="text-xs text-gray-400">Used as baseline for all divergence detection. Lowest margin, sharpest lines.</div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400">Active reference book</span>
          </div>
        </div>

        <div className="bg-[#0d0d18] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Detection Mode</span>
          </div>
          <div className="text-lg font-bold text-white mb-1">Divergence</div>
          <div className="text-xs text-gray-400">Detecting when soft books lag behind Pinnacle. The lag window = opportunity.</div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center">
            <div className="bg-red-500/10 rounded p-1">
              <div className="text-[10px] text-red-400 font-bold">PINNACLE_LAG</div>
            </div>
            <div className="bg-orange-500/10 rounded p-1">
              <div className="text-[10px] text-orange-400 font-bold">ARBITRAGE</div>
            </div>
            <div className="bg-yellow-500/10 rounded p-1">
              <div className="text-[10px] text-yellow-400 font-bold">MOVEMENT</div>
            </div>
          </div>
        </div>

        <div className="bg-[#0d0d18] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Best Windows</span>
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>🏓 Table Tennis</span>
              <span className="text-red-400">24/7</span>
            </div>
            <div className="flex justify-between">
              <span>🥊 MMA events</span>
              <span className="text-orange-400">Sat/Sun</span>
            </div>
            <div className="flex justify-between">
              <span>🏀 NBA playoffs</span>
              <span className="text-yellow-400">11PM WAT</span>
            </div>
            <div className="flex justify-between">
              <span>⚾ MLB</span>
              <span className="text-emerald-400">11PM WAT</span>
            </div>
            <div className="flex justify-between">
              <span>🎾 French Open</span>
              <span className="text-emerald-400">10AM WAT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom disclaimer */}
      <div className="flex items-center justify-between text-[10px] text-gray-700 pt-1">
        <span>SureEdge AI v2.4.1 — AI Market Intelligence</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          All systems operational
        </span>
      </div>
    </div>
  );
}
