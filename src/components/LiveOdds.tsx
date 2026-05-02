'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, RefreshCw, Zap, Eye } from 'lucide-react';

interface OddsEntry {
  bookmaker: string;
  home: number;
  draw: number;
  away: number;
}

interface LiveEvent {
  id: string;
  home: string;
  away: string;
  league: string;
  sport: string;
  startTime: string;
  odds: OddsEntry[];
  bestHome: OddsEntry;
  bestAway: OddsEntry;
  hasSurebet: boolean;
}

export default function LiveOdds() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('football');

  const sports = ['football', 'basketball', 'tennis'];

  const fetchOdds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/odds/live?sport=${selectedSport}`);
      const json = await res.json();
      if (json.success) setEvents(json.data.events);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedSport]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  const formatTime = (iso: string) => {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Live';
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Odds</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time odds comparison across bookmakers</p>
        </div>
        <button onClick={fetchOdds} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white text-sm transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Sport Tabs */}
      <div className="flex gap-2">
        {sports.map(s => (
          <button key={s} onClick={() => setSelectedSport(s)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${selectedSport === s ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, i) => (
            <motion.div key={event.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className={`rounded-xl border overflow-hidden ${event.hasSurebet ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#12121a] border-white/5'}`}>
              {/* Event Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  {event.hasSurebet && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                      <Zap className="w-3 h-3" /> Surebet
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-sm">{event.home} vs {event.away}</div>
                    <div className="text-xs text-gray-500">{event.league}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Activity className="w-3 h-3" /> {formatTime(event.startTime)}
                  </span>
                </div>
              </div>

              {/* Odds Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs text-gray-500 font-medium px-4 py-2">Bookmaker</th>
                      <th className="text-center text-xs text-gray-500 font-medium px-4 py-2">
                        <span className="flex items-center justify-center gap-1">Home {event.bestHome.bookmaker === event.odds[0]?.bookmaker && <Eye className="w-3 h-3 text-emerald-400" />}</span>
                      </th>
                      <th className="text-center text-xs text-gray-500 font-medium px-4 py-2">Draw</th>
                      <th className="text-center text-xs text-gray-500 font-medium px-4 py-2">
                        <span className="flex items-center justify-center gap-1">Away {event.bestAway.bookmaker === event.odds[0]?.bookmaker && <Eye className="w-3 h-3 text-emerald-400" />}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.odds.map((odds) => (
                      <tr key={odds.bookmaker} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 font-medium">{odds.bookmaker}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-mono ${odds.bookmaker === event.bestHome.bookmaker ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-300'}`}>
                            {odds.home.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-white/5 text-gray-300">{odds.draw.toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-mono ${odds.bookmaker === event.bestAway.bookmaker ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-300'}`}>
                            {odds.away.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
