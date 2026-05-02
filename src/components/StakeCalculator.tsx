'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Plus, Trash2, RotateCcw, CheckCircle2, AlertTriangle, PieChart } from 'lucide-react';
import { ResponsiveContainer, Tooltip, PieChart as PieChartComponent, Pie, Cell } from 'recharts';

interface Outcome {
  outcome: string;
  odds: number;
}

interface StakeResult {
  outcome: string;
  odds: number;
  stake: number;
  potentialReturn: number;
}

interface CalcResult {
  totalStake: number;
  stakes: StakeResult[];
  minReturn: number;
  maxReturn: number;
  guaranteedProfit: number;
  isArbitrage: boolean;
  roi: number;
  impliedProbability: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function StakeCalculator() {
  const [totalStake, setTotalStake] = useState(100);
  const [outcomes, setOutcomes] = useState<Outcome[]>([
    { outcome: 'Team A Win', odds: 2.10 },
    { outcome: 'Team B Win', odds: 2.20 },
  ]);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);

  const addOutcome = () => {
    setOutcomes([...outcomes, { outcome: `Outcome ${outcomes.length + 1}`, odds: 2.0 }]);
  };

  const removeOutcome = (index: number) => {
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
      setResult(null);
    }
  };

  const updateOutcome = (index: number, field: keyof Outcome, value: string | number) => {
    const updated = [...outcomes];
    updated[index] = { ...updated[index], [field]: value };
    setOutcomes(updated);
  };

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/surebet/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalStake, outcomes }),
      });
      const data = await res.json();
      if (data.success) setResult(data.data);
    } catch (err) {
      console.error('Calc error:', err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setTotalStake(100);
    setOutcomes([
      { outcome: 'Team A Win', odds: 2.10 },
      { outcome: 'Team B Win', odds: 2.20 },
    ]);
    setResult(null);
  };

  const pieData = result ? result.stakes.map(s => ({ name: s.outcome, value: s.stake })) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stake Calculator</h1>
        <p className="text-gray-400 text-sm mt-1">Calculate optimal stakes using the Dutching formula for guaranteed returns</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4 text-emerald-400" /> Input</h3>
            <button onClick={reset} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-1.5">Total Stake ($)</label>
            <input type="number" value={totalStake} onChange={e => setTotalStake(parseFloat(e.target.value) || 0)} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50" />
          </div>

          <div className="space-y-3 mb-6">
            <label className="block text-sm text-gray-400">Outcomes</label>
            {outcomes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={o.outcome} onChange={e => updateOutcome(i, 'outcome', e.target.value)} placeholder="Outcome name" className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                <input type="number" value={o.odds} onChange={e => updateOutcome(i, 'odds', parseFloat(e.target.value) || 0)} placeholder="Odds" step="0.01" className="w-24 bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                <button onClick={() => removeOutcome(i)} disabled={outcomes.length <= 2} className="p-2 rounded-lg text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={addOutcome} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
              <Plus className="w-3 h-3" /> Add Outcome
            </button>
          </div>

          <button onClick={calculate} disabled={loading || outcomes.some(o => o.odds <= 0)} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
            {loading ? 'Calculating...' : 'Calculate Stakes'}
          </button>
        </motion.div>

        {/* Results Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          {result && (
            <>
              {/* Status Badge */}
              <div className={`p-4 rounded-xl border ${result.isArbitrage ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                <div className="flex items-center gap-3">
                  {result.isArbitrage ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <AlertTriangle className="w-6 h-6 text-yellow-400" />}
                  <div>
                    <div className={`font-semibold ${result.isArbitrage ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {result.isArbitrage ? 'ARBITRAGE DETECTED' : 'NO ARBITRAGE'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {result.isArbitrage
                        ? `Guaranteed profit: $${result.guaranteedProfit.toFixed(2)} (${result.roi}% ROI)`
                        : `Loss: $${result.guaranteedProfit.toFixed(2)} — adjust odds or stakes`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="p-6 rounded-xl bg-[#12121a] border border-white/5">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-emerald-400" /> Stake Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChartComponent>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" stroke="none">
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'Stake']} />
                  </PieChartComponent>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-4 justify-center">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {d.name}: ${d.value.toFixed(2)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Stakes Table */}
              <div className="p-6 rounded-xl bg-[#12121a] border border-white/5">
                <h3 className="font-semibold mb-4">Optimal Stakes</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs text-gray-500 font-medium py-2">Outcome</th>
                      <th className="text-right text-xs text-gray-500 font-medium py-2">Odds</th>
                      <th className="text-right text-xs text-gray-500 font-medium py-2">Stake</th>
                      <th className="text-right text-xs text-gray-500 font-medium py-2">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stakes.map((s, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="py-2 font-medium">{s.outcome}</td>
                        <td className="py-2 text-right text-gray-400">{s.odds.toFixed(2)}</td>
                        <td className="py-2 text-right text-emerald-400">${s.stake.toFixed(2)}</td>
                        <td className="py-2 text-right">${s.potentialReturn.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Implied Probability:</span> <span className="font-medium">{result.impliedProbability}%</span></div>
                  <div><span className="text-gray-500">Min Return:</span> <span className="font-medium">${result.minReturn.toFixed(2)}</span></div>
                </div>
              </div>
            </>
          )}

          {!result && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 rounded-xl bg-[#12121a] border border-white/5">
              <Calculator className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Configure your outcomes and click calculate</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
