'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Filter, Clock, Volume2, VolumeX, Play, Search } from 'lucide-react';

const sports = ['All', 'Football', 'Basketball', 'Tennis', 'Baseball', 'Hockey', 'MMA'];

interface Surebet {
  id: string;
  match: string;
  sport: string;
  league: string;
  bookmaker1: string;
  bookmaker2: string;
  odds1: number;
  odds2: number;
  profit: number;
  roi: number;
  confidence: number;
  expiresAt: string;
  status: string;
}

export default function SurebetScanner() {
  const [scanning, setScanning] = useState(false);
  const [surebets, setSurebets] = useState<Surebet[]>([]);
  const [selectedSport, setSelectedSport] = useState('All');
  const [minProfit, setMinProfit] = useState(-5);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/surebet/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport: selectedSport.toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setSurebets(data.data.surebets);
        setLastScan(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  }, [selectedSport]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(scan, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, scan]);

  const filteredSurebets = surebets.filter(sb => sb.profit >= minProfit);

  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Surebet Scanner</h1>
          <p className="text-gray-400 text-sm mt-1">Scan bookmakers for arbitrage opportunities in real-time</p>
        </div>
        {lastScan && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" /> Last scan: {lastScan}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 rounded-xl bg-[#12121a] border border-white/5">
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={scan} disabled={scanning} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors shrink-0">
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
          <div className="flex flex-wrap gap-2 flex-1">
            {sports.map(s => (
              <button key={s} onClick={() => setSelectedSport(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedSport === s ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <input type="number" value={minProfit} onChange={e => setMinProfit(parseFloat(e.target.value) || 0)} placeholder="Min %" className="w-20 bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50" />
              <span className="text-xs text-gray-500">%</span>
            </div>
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`p-2 rounded-lg transition-colors ${autoRefresh ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-400'}`} title="Auto-refresh">
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-2 rounded-lg transition-colors ${soundEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-400'}`} title="Sound alerts">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-xl bg-[#12121a] border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {filteredSurebets.length} surebet{filteredSurebets.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {!surebets.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Search className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">Click &ldquo;Scan Now&rdquo; to find surebet opportunities</p>
          </div>
        ) : !filteredSurebets.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Filter className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">No surebets match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Match</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Bookmakers</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Odds</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Profit %</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">ROI</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Expires</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurebets.map((sb) => (
                  <motion.tr key={sb.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-6 py-3">
                      <div className="font-medium">{sb.match}</div>
                      <div className="text-xs text-gray-500">{sb.league}</div>
                    </td>
                    <td className="px-6 py-3 text-gray-400">
                      <div>{sb.bookmaker1}</div>
                      <div>{sb.bookmaker2}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-emerald-400">{sb.odds1}</div>
                      <div className="text-blue-400">{sb.odds2}</div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`font-medium ${sb.profit > 5 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {sb.profit}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-300">{sb.roi}%</td>
                    <td className="px-6 py-3 text-gray-500">{getTimeLeft(sb.expiresAt)}</td>
                    <td className="px-6 py-3">
                      <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-colors">
                        <Play className="w-3 h-3" /> Place
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
