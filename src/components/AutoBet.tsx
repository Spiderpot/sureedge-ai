'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Plus, ToggleLeft, ToggleRight, CheckCircle2, XCircle } from 'lucide-react';

interface AutoBetRule {
  id: string;
  name: string;
  sport: string | null;
  minProfit: number;
  maxStake: number;
  status: string;
  executions: number;
  successRate: number;
  profitGenerated: number;
}

const defaultRules: AutoBetRule[] = [
  { id: '1', name: 'Football Scalper', sport: 'Football', minProfit: 2.0, maxStake: 50, status: 'ACTIVE', executions: 156, successRate: 94.2, profitGenerated: 1240 },
  { id: '2', name: 'NBA Quick Strike', sport: 'Basketball', minProfit: 3.0, maxStake: 100, status: 'ACTIVE', executions: 89, successRate: 91.0, profitGenerated: 980 },
  { id: '3', name: 'Tennis Arbitrage', sport: 'Tennis', minProfit: 1.5, maxStake: 75, status: 'PAUSED', executions: 67, successRate: 88.1, profitGenerated: 540 },
];

const executionLog = [
  { id: 'e1', rule: 'Football Scalper', match: 'Man City vs Arsenal', stake: 50, profit: 12.50, status: 'success', time: '2 min ago' },
  { id: 'e2', rule: 'NBA Quick Strike', match: 'Lakers vs Celtics', stake: 100, profit: 28.30, status: 'success', time: '5 min ago' },
  { id: 'e3', rule: 'Football Scalper', match: 'Real Madrid vs Barcelona', stake: 50, profit: 8.70, status: 'success', time: '12 min ago' },
  { id: 'e4', rule: 'NBA Quick Strike', match: 'Warriors vs Bucks', stake: 100, profit: -5.00, status: 'failed', time: '18 min ago' },
  { id: 'e5', rule: 'Football Scalper', match: 'Liverpool vs Chelsea', stake: 50, profit: 15.20, status: 'success', time: '25 min ago' },
];

export default function AutoBet() {
  const [rules, setRules] = useState<AutoBetRule[]>(defaultRules);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', sport: 'All', minProfit: 2.0, maxStake: 100 });

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => ({
      ...r,
      status: r.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
    })));
  };

  const createRule = () => {
    if (!newRule.name) return;
    const rule: AutoBetRule = {
      id: Date.now().toString(),
      name: newRule.name,
      sport: newRule.sport === 'All' ? null : newRule.sport,
      minProfit: newRule.minProfit,
      maxStake: newRule.maxStake,
      status: 'ACTIVE',
      executions: 0,
      successRate: 0,
      profitGenerated: 0,
    };
    setRules(prev => [...prev, rule]);
    setNewRule({ name: '', sport: 'All', minProfit: 2.0, maxStake: 100 });
    setShowCreateForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bot className="w-6 h-6 text-emerald-400" /> Auto-Bet</h1>
          <p className="text-gray-400 text-sm mt-1">Automate your surebet execution with custom rules</p>
        </div>
        <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Create Rule Form */}
      {showCreateForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-6 rounded-xl bg-[#12121a] border border-emerald-500/20">
          <h3 className="font-semibold mb-4">Create Auto-Bet Rule</h3>
          <div className="grid sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Rule Name</label>
              <input type="text" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="e.g. Football Scalper" className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Sport</label>
              <select value={newRule.sport} onChange={e => setNewRule({ ...newRule, sport: e.target.value })} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                {['All', 'Football', 'Basketball', 'Tennis', 'Baseball', 'Hockey'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Min Profit (%)</label>
              <input type="number" value={newRule.minProfit} onChange={e => setNewRule({ ...newRule, minProfit: parseFloat(e.target.value) })} step="0.1" className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Max Stake ($)</label>
              <input type="number" value={newRule.maxStake} onChange={e => setNewRule({ ...newRule, maxStake: parseFloat(e.target.value) })} className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={createRule} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors">Create Rule</button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Rules */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rules.map((rule, i) => (
          <motion.div key={rule.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-5 rounded-xl bg-[#12121a] border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{rule.name}</h3>
              <button onClick={() => toggleRule(rule.id)} className="text-gray-500 hover:text-white transition-colors">
                {rule.status === 'ACTIVE' ? <ToggleRight className="w-8 h-8 text-emerald-400" /> : <ToggleLeft className="w-8 h-8" />}
              </button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                {rule.status}
              </span>
              {rule.sport && <span className="text-xs text-gray-500">{rule.sport}</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">Min Profit</div>
                <div className="font-medium">{rule.minProfit}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Max Stake</div>
                <div className="font-medium">${rule.maxStake}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Executions</div>
                <div className="font-medium">{rule.executions}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Success Rate</div>
                <div className="font-medium">{rule.successRate}%</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 text-sm">
              <span className="text-gray-500">Profit: </span>
              <span className={`font-semibold ${rule.profitGenerated >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${rule.profitGenerated.toFixed(2)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Execution Log */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-xl bg-[#12121a] border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold">Execution Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Rule</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Match</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Stake</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Profit</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Status</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {executionLog.map((log) => (
                <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-6 py-3 font-medium">{log.rule}</td>
                  <td className="px-6 py-3 text-gray-400">{log.match}</td>
                  <td className="px-6 py-3">${log.stake}</td>
                  <td className={`px-6 py-3 font-medium ${log.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {log.profit >= 0 ? '+' : ''}{log.profit.toFixed(2)}
                  </td>
                  <td className="px-6 py-3">
                    {log.status === 'success' ? (
                      <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Success</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" /> Failed</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
