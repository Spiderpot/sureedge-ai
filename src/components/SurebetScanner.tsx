'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RefreshCw, ArrowUpDown, Timer, Shield, TrendingUp,
  AlertTriangle, ChevronDown, Volume2, VolumeX,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface SurebetOutcome {
  outcome: string;
  odds: number;
  bookmaker: string;
  bookmakerKey: string;
  impliedProb: number;
  nigeriaAccess?: boolean;
  depositMethod?: string;
}

interface Surebet {
  id: string;
  eventId: string;
  match: string;
  sport: string;
  league: string;
  commenceTime: string;
  arbPercentage: number;
  arbFraction: number;
  profit: number;
  roi: number;
  isGenuineArb: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  bookmakerCount: number;
  accessTag?: string;
  outcomes: SurebetOutcome[];
  status: string;
  detectedAt: string;
  expiresAt: string;
}

const SPORTS = [
  { key: 'all',        label: 'All Sports', icon: '\u{1F3C6}' },
  { key: 'football',   label: 'Football',   icon: '\u26BD' },
  { key: 'basketball', label: 'Basketball', icon: '\u{1F3C0}' },
  { key: 'tennis',     label: 'Tennis',     icon: '\u{1F3BE}' },
  { key: 'baseball',   label: 'Baseball',   icon: '\u26BE' },
  { key: 'hockey',     label: 'Hockey',     icon: '\u{1F3D2}' },
  { key: 'mma',        label: 'MMA',        icon: '\u{1F94A}' },
];

type SortOption = 'arb' | 'expiry' | 'priority';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'arb',      label: 'Highest Arb %' },
  { key: 'expiry',   label: 'Soonest Expiry' },
  { key: 'priority', label: 'Priority Rank' },
];

function arbColor(pct: number): string {
  if (pct >= 5) return 'text-emerald-400';
  if (pct >= 3) return 'text-yellow-400';
  if (pct >= 0) return 'text-emerald-400';
  return 'text-gray-400';
}

function arbBg(pct: number): string {
  if (pct >= 5) return 'bg-emerald-500/10 border-emerald-500/20';
  if (pct >= 3) return 'bg-yellow-500/10 border-yellow-500/20';
  if (pct >= 0) return 'bg-emerald-500/10 border-emerald-500/20';
  return 'bg-white/5 border-white/10';
}

function riskBadge(risk: string) {
  switch (risk) {
    case 'LOW':    return { color: 'bg-emerald-500/20 text-emerald-400', Icon: Shield };
    case 'MEDIUM': return { color: 'bg-yellow-500/20 text-yellow-400', Icon: AlertTriangle };
    case 'HIGH':   return { color: 'bg-red-500/20 text-red-400', Icon: AlertTriangle };
    default:       return { color: 'bg-gray-500/20 text-gray-400', Icon: Shield };
  }
}

function sportIcon(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes('baseball') || s.includes('mlb'))    return '\u26BE';
  if (s.includes('basketball') || s.includes('nba'))  return '\u{1F3C0}';
  if (s.includes('football') || s.includes('soccer')) return '\u26BD';
  if (s.includes('tennis'))                            return '\u{1F3BE}';
  if (s.includes('hockey') || s.includes('nhl'))      return '\u{1F3D2}';
  if (s.includes('mma') || s.includes('mixed'))       return '\u{1F94A}';
  return '\u{1F3C6}';
}

function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const isExpired = timeLeft === 'Expired';
  const isUrgent = !isExpired && parseInt(timeLeft) <= 2;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full ${
      isExpired ? 'bg-red-500/20 text-red-400' :
      isUrgent  ? 'bg-orange-500/20 text-orange-400 animate-pulse' :
                  'bg-white/5 text-gray-400'
    }`}>
      <Timer className="w-3 h-3" />
      {timeLeft}
    </span>
  );
}

function SurebetCard({ sb, rank, onCalculate }: { sb: Surebet; rank: number; onCalculate: () => void }) {
  const { color, Icon } = riskBadge(sb.riskLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, delay: rank * 0.05 }}
      className={`rounded-xl border p-4 ${arbBg(sb.arbPercentage)} transition-all hover:border-emerald-500/30`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold">
            P{rank + 1}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{sportIcon(sb.sport)}</span>
              <h3 className="font-semibold text-white text-sm">{sb.match}</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{sb.sport}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${arbColor(sb.arbPercentage)}`}>
            {sb.arbPercentage > 0 ? '+' : ''}{sb.arbPercentage.toFixed(3)}%
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            {sb.isGenuineArb ? 'Guaranteed Profit' : 'Near-Arb'}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {sb.outcomes.map((o, i) => (
          <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-xs text-gray-400">
                  {o.bookmaker}
                  {o.nigeriaAccess !== undefined && (
                    <span className={`ml-1.5 text-[9px] px-1 py-0.5 rounded ${o.nigeriaAccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {o.nigeriaAccess ? 'NG \u2713' : 'VPN'}
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-white">{o.outcome}</div>
                {o.nigeriaAccess && o.depositMethod && (
                  <div className="text-[9px] text-gray-600">{o.depositMethod}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">{o.odds.toFixed(2)}</div>
              <div className="text-[10px] text-gray-500">{o.impliedProb}%</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>
            <Icon className="w-3 h-3" />
            {sb.riskLevel}
          </span>
          <CountdownBadge expiresAt={sb.expiresAt} />
          {sb.accessTag && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              sb.accessTag === 'FULL_ACCESS' ? 'bg-emerald-500/20 text-emerald-400' :
              sb.accessTag === 'PARTIAL_ACCESS' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {sb.accessTag === 'FULL_ACCESS' ? 'Both NG accessible' :
               sb.accessTag === 'PARTIAL_ACCESS' ? '1 NG accessible' :
               'VPN needed'}
            </span>
          )}
          <span className="text-[10px] text-gray-600">{sb.bookmakerCount} books</span>
        </div>
        <button onClick={onCalculate} className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
          <TrendingUp className="w-3.5 h-3.5" />
          Calculate Stake
        </button>
      </div>
    </motion.div>
  );
}

export default function SurebetScanner() {
  const { setActiveView, setSelectedSurebet } = useAppStore();
  const [surebets, setSurebets] = useState<Surebet[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sport, setSport] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('arb');
  const [sortOpen, setSortOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaRemaining, setQuotaRemaining] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [debug, setDebug] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setScanning(true);
    try {
      const res = await fetch('/api/surebet/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport }),
      });
      const data = await res.json();
      if (data.success) {
        setSurebets(data.data.surebets || []);
        setQuotaUsed(data.data.quotaUsed || 0);
        setQuotaRemaining(data.data.quotaRemaining || 0);
        setDebug(data.data.debug || []);
        setLastScan(new Date().toLocaleTimeString());
        if (soundOn && data.data.surebets?.some((s: Surebet) => s.isGenuineArb)) {
          try { new Audio('/alert.mp3').play().catch(() => {}); } catch {}
        }
      }
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setScanning(false), 3000);
    }
  }, [sport, soundOn]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(scan, 60000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, scan]);

  const sorted = [...surebets].sort((a, b) => {
    switch (sortBy) {
      case 'arb':    return b.arbPercentage - a.arbPercentage;
      case 'expiry': return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      default:       return b.arbPercentage - a.arbPercentage;
    }
  });

  const handleCalculateStake = (sb: Surebet) => {
    setSelectedSurebet({
      id: sb.id, match: sb.match, sport: sb.sport, league: sb.league,
      arbPercentage: sb.arbPercentage, isGenuineArb: sb.isGenuineArb,
      riskLevel: sb.riskLevel, outcomes: sb.outcomes, expiresAt: sb.expiresAt,
    });
    setActiveView('calculator');
  };

  const genuineCount = surebets.filter(s => s.isGenuineArb).length;
  const nearArbCount = surebets.filter(s => !s.isGenuineArb).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Surebet Scanner</h1>
          <p className="text-gray-400 text-sm mt-1">Scan bookmakers for arbitrage opportunities in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          {scanning && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              Scanning...
            </div>
          )}
          {lastScan && <span className="text-xs text-gray-500">Last scan: {lastScan}</span>}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[#12121a] border border-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={scan} disabled={loading}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Scanning...' : 'Scan Now'}
          </motion.button>

          <div className="flex flex-wrap items-center gap-1.5">
            {SPORTS.map(s => (
              <button key={s.key} onClick={() => setSport(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sport === s.key
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/5 hover:text-white hover:border-white/10'
                }`}>
                <span className="mr-1">{s.icon}</span>{s.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="relative">
            <button onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <ArrowUpDown className="w-3 h-3" />
              {SORT_OPTIONS.find(o => o.key === sortBy)?.label}
              <ChevronDown className={`w-3 h-3 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/10 rounded-lg py-1 z-20 w-44 shadow-xl">
                {SORT_OPTIONS.map(o => (
                  <button key={o.key} onClick={() => { setSortBy(o.key); setSortOpen(false); }}
                    className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      sortBy === o.key ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}>{o.label}</button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg border transition-colors ${autoRefresh ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
            title={autoRefresh ? 'Auto-refresh ON (60s)' : 'Auto-refresh OFF'}>
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
          </button>

          <button onClick={() => setSoundOn(!soundOn)}
            className={`p-2 rounded-lg border transition-colors ${soundOn ? 'bg-white/5 border-white/10 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-500'}`}
            title={soundOn ? 'Sound ON' : 'Sound OFF'}>
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {(surebets.length > 0 || quotaUsed > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-[#12121a] border border-white/5">
            <div className="text-xs text-gray-500">Total Found</div>
            <div className="text-lg font-bold text-white">{surebets.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#12121a] border border-white/5">
            <div className="text-xs text-gray-500">Genuine Arbs</div>
            <div className="text-lg font-bold text-emerald-400">{genuineCount}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#12121a] border border-white/5">
            <div className="text-xs text-gray-500">Near-Arbs</div>
            <div className="text-lg font-bold text-yellow-400">{nearArbCount}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#12121a] border border-white/5">
            <div className="text-xs text-gray-500">Credits Used</div>
            <div className="text-lg font-bold text-white">{quotaUsed}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#12121a] border border-white/5">
            <div className="text-xs text-gray-500">Credits Left</div>
            <div className={`text-lg font-bold ${quotaRemaining < 50 ? 'text-red-400' : 'text-white'}`}>{quotaRemaining}</div>
          </div>
        </div>
      )}

      {debug.length > 0 && (
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer hover:text-gray-400">API debug info</summary>
          <pre className="mt-1 p-2 bg-[#0a0a0f] rounded-lg">{debug.join('\n')}</pre>
        </details>
      )}

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {loading && !surebets.length ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 rounded-xl bg-[#12121a] border border-white/5">
              <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
              <p className="text-sm text-gray-400">Scanning across bookmakers...</p>
              <p className="text-xs text-gray-600 mt-1">Checking Pinnacle, Bet365, DraftKings, Betfair...</p>
            </motion.div>
          ) : sorted.length > 0 ? (
            sorted.map((sb, i) => (
              <SurebetCard key={sb.id} sb={sb} rank={i} onCalculate={() => handleCalculateStake(sb)} />
            ))
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 rounded-xl bg-[#12121a] border border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-sm text-gray-400 mb-1">No opportunities found yet</p>
              <p className="text-xs text-gray-600 max-w-xs text-center">
                Click <span className="text-emerald-400">Scan Now</span> to search. Best results during live games and 30 min before kickoff.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-600 pt-2">
        <span>SureEdge AI v2.4.1</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          All systems operational
        </span>
      </div>
    </div>
  );
}
