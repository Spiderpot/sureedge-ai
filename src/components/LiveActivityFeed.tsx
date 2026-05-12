'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityItem {
  id:        string;
  time:      string;
  emoji:     string;
  message:   string;
  type:      'movement' | 'divergence' | 'volatility' | 'scan' | 'alert';
  hot:       boolean;
}

const ACTIVITY_TEMPLATES = [
  { emoji: '⚡', message: 'Pinnacle line moved — MMA', type: 'movement' as const, hot: true },
  { emoji: '🔥', message: 'Table Tennis volatility rising', type: 'volatility' as const, hot: true },
  { emoji: '📈', message: 'NBA divergence detected', type: 'divergence' as const, hot: true },
  { emoji: '⚽', message: 'La Liga odds shifting', type: 'movement' as const, hot: false },
  { emoji: '🚨', message: 'Sharp movement detected — Tennis', type: 'movement' as const, hot: true },
  { emoji: '🔍', message: 'Scanning 247 live events', type: 'scan' as const, hot: false },
  { emoji: '📊', message: 'NHL line movement tracked', type: 'movement' as const, hot: false },
  { emoji: '💠', message: 'Pinnacle vs 1xBet spread widening', type: 'divergence' as const, hot: true },
  { emoji: '⚾', message: 'MLB overnight markets active', type: 'scan' as const, hot: false },
  { emoji: '🎾', message: 'French Open volatility spike', type: 'volatility' as const, hot: true },
  { emoji: '🥊', message: 'MMA pre-fight odds moving', type: 'movement' as const, hot: true },
  { emoji: '📡', message: 'Monitoring 4 premium bookmakers', type: 'scan' as const, hot: false },
  { emoji: '🏀', message: 'NBA live market inefficiency', type: 'divergence' as const, hot: true },
  { emoji: '⚡', message: 'Bet365 lagging behind Pinnacle', type: 'divergence' as const, hot: true },
  { emoji: '🔥', message: 'High volatility period — MMA', type: 'volatility' as const, hot: true },
  { emoji: '📈', message: 'Serie A odds divergence', type: 'divergence' as const, hot: false },
  { emoji: '🎯', message: 'Edge opportunity window opening', type: 'alert' as const, hot: true },
  { emoji: '📊', message: 'Tracking sharp line movement', type: 'movement' as const, hot: false },
  { emoji: '🔍', message: 'Table Tennis — 12 live events', type: 'scan' as const, hot: false },
  { emoji: '💡', message: '1xBet diverging from market', type: 'divergence' as const, hot: true },
];

function formatTime(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function randomItem() {
  return ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
}

export default function LiveActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id:      `init_${i}`,
      time:    formatTime(),
      ...randomItem(),
    }))
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const template = randomItem();
      const newItem: ActivityItem = {
        id:   `item_${Date.now()}_${Math.random()}`,
        time: formatTime(),
        ...template,
      };
      setItems(prev => [newItem, ...prev.slice(0, 19)]);
    }, 2500);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div className="rounded-xl bg-[#0d0d18] border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Live Activity Feed</span>
        </div>
        <span className="text-[10px] text-gray-500">Real-time market signals</span>
      </div>

      {/* Feed */}
      <div className="h-48 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d0d18] z-10 pointer-events-none" />
        <AnimatePresence mode="popLayout">
          {items.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-3 px-4 py-2 border-b border-white/3 ${item.hot ? 'bg-emerald-500/3' : ''}`}
            >
              <span className="text-sm flex-shrink-0">{item.emoji}</span>
              <span className={`text-xs flex-1 ${item.hot ? 'text-gray-200' : 'text-gray-500'}`}>
                {item.message}
              </span>
              <span className="text-[10px] text-gray-700 font-mono flex-shrink-0">{item.time}</span>
              {item.hot && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full flex-shrink-0">HOT</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
