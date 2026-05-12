'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityItem {
  id:    string;
  time:  string;
  emoji: string;
  msg:   string;
  hot:   boolean;
}

const DEMO_FEED = [
  { emoji: '\u26A1', msg: 'Pinnacle line moved — NHL',              hot: true },
  { emoji: '\u{1F525}', msg: 'MMA volatility rising',              hot: true },
  { emoji: '\u{1F4C8}', msg: 'NBA divergence detected',            hot: true },
  { emoji: '\u26BD', msg: 'La Liga odds shifting',                  hot: false },
  { emoji: '\u{1F6A8}', msg: 'Sharp movement detected — Tennis',   hot: true },
  { emoji: '\u{1F50D}', msg: 'Scanning 247 live events',           hot: false },
  { emoji: '\u{1F4CA}', msg: 'NHL line movement tracked',           hot: false },
  { emoji: '\u{1F4A0}', msg: 'Pinnacle vs 1xBet spread widening',  hot: true },
  { emoji: '\u26BE', msg: 'MLB overnight markets active',           hot: false },
  { emoji: '\u{1F3BE}', msg: 'French Open volatility spike',       hot: true },
  { emoji: '\u{1F94A}', msg: 'MMA pre-fight odds moving',          hot: true },
  { emoji: '\u{1F4E1}', msg: 'Monitoring 4 premium bookmakers',    hot: false },
  { emoji: '\u{1F3C0}', msg: 'NBA live market inefficiency',       hot: true },
  { emoji: '\u26A1', msg: 'Bet365 lagging behind Pinnacle',        hot: true },
  { emoji: '\u{1F525}', msg: 'High volatility period — MMA',       hot: true },
  { emoji: '\u{1F4C8}', msg: 'Serie A odds divergence',            hot: false },
  { emoji: '\u{1F3AF}', msg: 'Edge opportunity window opening',    hot: true },
  { emoji: '\u{1F4CA}', msg: 'Tracking sharp line movement',       hot: false },
];

function fmt(): string {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function makeItem(t: { emoji: string; msg: string; hot: boolean }): ActivityItem {
  return { id: `${Date.now()}_${Math.random()}`, time: fmt(), ...t };
}

export default function LiveActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>(() =>
    DEMO_FEED.slice(0, 8).map(makeItem)
  );
  const [isReal, setIsReal] = useState(false);
  const demoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Try to fetch real activity, fall back to demo
  useEffect(() => {
    const fetchReal = async () => {
      try {
        const r = await fetch('/api/activity');
        const d = await r.json() as { success: boolean; data: { activities: { ts: number; sport: string; event: string; type: string }[] } };
        if (d.success && d.data.activities.length > 0) {
          const realItems = d.data.activities.map(a => ({
            id:    String(a.ts),
            time:  new Date(a.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            emoji: a.type === 'alert' ? '\u{1F6A8}' : '\u{1F50D}',
            msg:   a.event,
            hot:   a.type === 'alert',
          }));
          setItems(realItems);
          setIsReal(true);
        }
      } catch { /* use demo */ }
    };

    fetchReal();
    const realInterval = setInterval(fetchReal, 10_000);

    // Demo feed — adds new item every 2.5s
    demoRef.current = setInterval(() => {
      if (!isReal) {
        const t = DEMO_FEED[Math.floor(Math.random() * DEMO_FEED.length)];
        setItems(prev => [makeItem(t), ...prev.slice(0, 19)]);
      }
    }, 2500);

    return () => {
      clearInterval(realInterval);
      if (demoRef.current) clearInterval(demoRef.current);
    };
  }, [isReal]);

  return (
    <div className="rounded-xl bg-[#0d0d18] border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-white uppercase tracking-wider">Live Activity Feed</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isReal ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
          {isReal ? 'LIVE' : 'DEMO'}
        </span>
      </div>

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
              <span className={`text-xs flex-1 ${item.hot ? 'text-gray-200' : 'text-gray-500'}`}>{item.msg}</span>
              <span className="text-[10px] text-gray-700 font-mono flex-shrink-0">{item.time}</span>
              {item.hot && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full flex-shrink-0">LIVE</span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
