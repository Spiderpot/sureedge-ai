'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Minus, TrendingUp, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  createdAt: string;
}

interface BankrollData {
  balance: number;
  totalProfit: number;
  totalDeposits: number;
  totalWithdrawals: number;
  profitHistory: Array<{ date: string; profit: number }>;
  recentTransactions: Transaction[];
}

export default function BankrollManager() {
  const [data, setData] = useState<BankrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBankroll();
  }, []);

  const fetchBankroll = async () => {
    try {
      const res = await fetch('/api/bankroll/summary');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async (type: 'deposit' | 'withdraw') => {
    if (!amount || parseFloat(amount) <= 0) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/bankroll/summary', { method: 'GET' });
      // Demo: just update local state
      if (data) {
        const amt = parseFloat(amount);
        setData({
          ...data,
          balance: type === 'deposit' ? data.balance + amt : Math.max(0, data.balance - amt),
          totalDeposits: type === 'deposit' ? data.totalDeposits + amt : data.totalDeposits,
          totalWithdrawals: type === 'withdraw' ? data.totalWithdrawals + amt : data.totalWithdrawals,
        });
      }
      setShowDeposit(false);
      setShowWithdraw(false);
      setAmount('');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bankroll Manager</h1>
          <p className="text-gray-400 text-sm mt-1">Track your balance, deposits, and withdrawals</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowDeposit(true)} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Deposit
          </button>
          <button onClick={() => setShowWithdraw(true)} className="flex items-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Minus className="w-4 h-4" /> Withdraw
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Balance', value: `$${data?.balance.toFixed(2) || '0.00'}`, icon: Wallet, color: 'emerald' },
          { label: 'Total Profit', value: `$${data?.totalProfit.toFixed(2) || '0.00'}`, icon: TrendingUp, color: 'emerald' },
          { label: 'Total Deposits', value: `$${data?.totalDeposits.toFixed(2) || '0.00'}`, icon: ArrowDownCircle, color: 'blue' },
          { label: 'Total Withdrawals', value: `$${data?.totalWithdrawals.toFixed(2) || '0.00'}`, icon: ArrowUpCircle, color: 'orange' },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-4 rounded-xl bg-[#12121a] border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">{card.label}</span>
            </div>
            <div className="text-xl font-bold">{card.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Deposit/Withdraw Modal */}
      {(showDeposit || showWithdraw) && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`p-6 rounded-xl border ${showDeposit ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <h3 className="font-semibold mb-4">{showDeposit ? 'Make a Deposit' : 'Request a Withdrawal'}</h3>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50" />
            </div>
            <button onClick={() => handleTransaction(showDeposit ? 'deposit' : 'withdraw')} disabled={processing} className={`px-6 py-2.5 rounded-lg font-medium text-sm text-white transition-colors ${showDeposit ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
              {processing ? 'Processing...' : showDeposit ? 'Deposit' : 'Withdraw'}
            </button>
            <button onClick={() => { setShowDeposit(false); setShowWithdraw(false); setAmount(''); }} className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white bg-white/5 transition-colors">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Profit Chart */}
      {data?.profitHistory && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
          <h3 className="font-semibold mb-1">Daily P&L</h3>
          <p className="text-xs text-gray-500 mb-6">Last 30 days</p>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.profitHistory}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, 'P&L']} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#pnlGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Transaction History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl bg-[#12121a] border border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="font-semibold">Transaction History</h3>
        </div>
        {data?.recentTransactions && data.recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Date</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Type</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Amount</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-6 py-3 text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-3">
                      <span className={`capitalize px-2 py-1 rounded-full text-xs ${tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`px-6 py-3 font-medium ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-gray-400 capitalize">{tx.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Wallet className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No transactions yet</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
