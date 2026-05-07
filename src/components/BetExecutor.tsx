'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ExternalLink, Copy, Check, AlertTriangle, Clock,
  ChevronRight, Shield, X,
} from 'lucide-react';

interface BetLeg {
  outcome: string;
  odds: number;
  bookmaker: string;
  bookmakerUrl: string;
  stake: number;
  potentialReturn: number;
  depositMethod: string;
}

interface BetExecutorProps {
  match: string;
  sport: string;
  arbPercentage: number;
  totalStake: number;
  legs: BetLeg[];
  guaranteedProfit: number;
  expiresAt: string;
  onClose: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied
          ? 'bg-emerald-500 text-white'
          : 'bg-white/10 text-gray-300 hover:bg-white/20'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}

export default function BetExecutor({
  match, sport, arbPercentage, totalStake, legs,
  guaranteedProfit, expiresAt, onClose,
}: BetExecutorProps) {
  const [step, setStep] = useState(0); // 0=ready, 1=bet1 placed, 2=both placed
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('EXPIRED'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const openBothSites = () => {
    // Open both bookmaker sites simultaneously
    for (const leg of legs) {
      if (leg.bookmakerUrl) {
        window.open(leg.bookmakerUrl, `_bet_${leg.bookmaker}`, 'width=600,height=800');
      }
    }
  };

  const isExpired = timeLeft === 'EXPIRED';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#12121a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white">Execute Arbitrage</h2>
            <p className="text-xs text-gray-400">{match} &bull; {sport}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold ${
              isExpired ? 'bg-red-500/20 text-red-400' :
              parseInt(timeLeft) <= 1 ? 'bg-orange-500/20 text-orange-400 animate-pulse' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {timeLeft}
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profit summary */}
        <div className="p-4 bg-emerald-500/5 border-b border-white/5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400">Total Stake</div>
              <div className="text-lg font-bold text-white">${totalStake.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Guaranteed Profit</div>
              <div className="text-lg font-bold text-emerald-400">+${guaranteedProfit.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">ROI</div>
              <div className="text-lg font-bold text-emerald-400">+{arbPercentage.toFixed(2)}%</div>
            </div>
          </div>
        </div>

        {/* Open both sites button */}
        <div className="p-4 border-b border-white/5">
          <button
            onClick={openBothSites}
            disabled={isExpired}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Both Bookmaker Sites
          </button>
          <p className="text-[10px] text-gray-600 text-center mt-2">
            Opens {legs.map(l => l.bookmaker).join(' + ')} in new windows side by side
          </p>
        </div>

        {/* Step-by-step bet legs */}
        <div className="p-4 space-y-3">
          {legs.map((leg, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border transition-all ${
                step > i
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : step === i
                  ? 'bg-white/5 border-emerald-500/30'
                  : 'bg-white/5 border-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step > i ? 'bg-emerald-500 text-white' : 'bg-white/10 text-gray-400'
                  }`}>
                    {step > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{leg.bookmaker}</div>
                    <div className="text-[10px] text-gray-500">{leg.depositMethod}</div>
                  </div>
                </div>
                {leg.bookmakerUrl && (
                  <a
                    href={leg.bookmakerUrl}
                    target={`_bet_${leg.bookmaker}`}
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 bg-black/20 rounded-lg p-2 text-center">
                <div>
                  <div className="text-[10px] text-gray-500">Bet On</div>
                  <div className="text-xs font-medium text-white">{leg.outcome}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Odds</div>
                  <div className="text-xs font-bold text-yellow-400">{leg.odds.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">Stake</div>
                  <div className="text-sm font-bold text-emerald-400">${leg.stake.toFixed(2)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="text-[10px] text-gray-500">
                  Returns: <span className="text-white">${leg.potentialReturn.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={leg.stake.toFixed(2)} label="Copy Stake" />
                  {step === i && (
                    <button
                      onClick={() => setStep(i + 1)}
                      className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-500/30 transition-colors"
                    >
                      Bet Placed <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Completion */}
        {step >= legs.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 bg-emerald-500/10 border-t border-emerald-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-400">Arbitrage Locked In!</div>
                <div className="text-xs text-gray-400">
                  Guaranteed profit of ${guaranteedProfit.toFixed(2)} regardless of outcome
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Warning */}
        {!isExpired && step < legs.length && (
          <div className="px-4 pb-4">
            <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-[10px]">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Place bet {step + 1} first (longer odds), then bet {step + 2}. Never place one without the other.</span>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
