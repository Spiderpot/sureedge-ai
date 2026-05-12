'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, Activity, Target } from 'lucide-react';

interface HotMarket {
  sport:      string;
  icon:       string;
  volatility: number;   // 0-100
  events:     number;
  signal:     string;
  trending:   boolean;
}

const MARKETS: HotMarket[] = [
  { sport: 'Table Tennis',   icon: '🏓', volatility: 100, events: 24, signal: 'EXTREME',  trending: true },
  { sport: 'MMA / UFC',      icon: '🥊', volatility: 95,  events: 8,  signal: 'VERY HIGH', trending: true },
  { sport: 'NBA Basketball', icon: '🏀', volatility: 85,  events: 12, signal: 'HIGH',      trending: true },
  { sport: 'NHL Hockey',     icon: '🏒', volatility: 80,  events: 6,  signal: 'HIGH',      trending: false },
  { sport: 'Tennis ATP',     icon: '🎾', volatility: 75,  events: 18, signal: 'HIGH',      trending: true },
  { sport: 'MLB Baseball',   icon: '⚾', volatility: 65,  events: 15, signal: 'MEDIUM',    trending: false },
  { sport: 'La Liga',        icon: '⚽', volatility: 55,  events: 10, signal: 'MEDIUM',    trending: false },
  { sport: 'EPL Football',   icon: '⚽', volatility: 40,  events: 10, signal: 'LOW',       trending: false },
];

function volatilityColor(v: number): string {
  if (v >= 80) return 'text-red-400';
  if (v >= 60) return 'text-orange-400';
  if (v >= 40) return 'text-yellow-400';
  return 'text-gray-400';
}

function volatilityBg(v: number): string {
  if (v >= 80) return 'bg-red-500/10 border-red-500/20';
  if (v >= 60) return 'bg-orange-500/10 border-orange-500/20';
  if (v >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-white/5 border-white/5';
}

export default function HotMarkets() {
  const [tick, setTick] = useState(0);

  // Simulate volatility fluctuation
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl bg-[#0d0d18] border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Hot Markets</span>
        </div>
        <span className="text-[10px] text-gray-500">Ranked by volatility</span>
      </div>

      <div className="p-3 space-y-2">
        {MARKETS.slice(0, 5).map((market, i) => (
          <motion.div
            key={market.sport}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 p-2.5 rounded-lg border ${volatilityBg(market.volatility)}`}
          >
            <span className="text-lg">{market.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white truncate">{market.sport}</span>
                {market.trending && (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      market.volatility >= 80 ? 'bg-red-400' :
                      market.volatility >= 60 ? 'bg-orange-400' :
                      market.volatility >= 40 ? 'bg-yellow-400' : 'bg-gray-400'
                    }`}
                    animate={{ width: `${market.volatility + (tick % 3) * 2}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className={`text-[10px] font-mono ${volatilityColor(market.volatility)}`}>
                  {market.volatility}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-[10px] font-semibold ${volatilityColor(market.volatility)}`}>
                {market.signal}
              </span>
              <div className="text-[9px] text-gray-600">{market.events} events</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Scanner status */}
      <div className="px-4 pb-3 pt-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <Target className="w-3 h-3" />
          Tracking Pinnacle · 1xBet · Bet365 · 22Bet
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <Zap className="w-3 h-3" />
          Active
        </div>
      </div>
    </div>
  );
}
