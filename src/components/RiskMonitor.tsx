'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Shield, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface RiskFactor {
  score: number;
  status: string;
  detail: string;
}

interface RiskData {
  overallScore: number;
  riskLevel: string;
  factors: Record<string, RiskFactor>;
  recommendations: string[];
}

const factorLabels: Record<string, { label: string; desc: string }> = {
  accountHealth: { label: 'Account Health', desc: 'Bookmaker account status' },
  exposureLevel: { label: 'Exposure Level', desc: 'Current bet exposure' },
  bookmakerReliability: { label: 'Bookmaker Reliability', desc: 'Platform trust scores' },
  bankrollUtilization: { label: 'Bankroll Utilization', desc: 'Capital allocation' },
  volatility: { label: 'Market Volatility', desc: 'Odds movement speed' },
};

export default function RiskMonitor() {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRisk();
  }, []);

  const fetchRisk = async () => {
    try {
      const res = await fetch('/api/risk/score');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getGaugeColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getRiskIcon = (level: string) => {
    if (level === 'LOW') return ShieldCheck;
    if (level === 'MEDIUM') return Shield;
    return ShieldAlert;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'good') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    return <Info className="w-4 h-4 text-red-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const RiskIcon = getRiskIcon(data.riskLevel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Risk Monitor</h1>
        <p className="text-gray-400 text-sm mt-1">Real-time risk assessment across all your betting activities</p>
      </div>

      {/* Overall Score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 p-8 rounded-xl bg-[#12121a] border border-white/5 flex flex-col items-center justify-center text-center">
          <div className="relative w-40 h-40 mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={getGaugeColor(data.overallScore)} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(data.overallScore / 100) * 314} 314`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${getScoreColor(data.overallScore)}`}>{data.overallScore}</span>
              <span className="text-xs text-gray-500">/ 100</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <RiskIcon className={`w-5 h-5 ${getScoreColor(data.overallScore)}`} />
            <span className={`text-lg font-semibold ${getScoreColor(data.overallScore)}`}>{data.riskLevel} RISK</span>
          </div>
          <p className="text-xs text-gray-500">Overall risk assessment score</p>
        </div>

        {/* Risk Factors */}
        <div className="md:col-span-2 p-6 rounded-xl bg-[#12121a] border border-white/5">
          <h3 className="font-semibold mb-6">Risk Factors</h3>
          <div className="space-y-5">
            {Object.entries(data.factors).map(([key, factor]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(factor.status)}
                    <div>
                      <div className="text-sm font-medium">{factorLabels[key]?.label || key}</div>
                      <div className="text-xs text-gray-500">{factorLabels[key]?.desc || ''}</div>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${getScoreColor(factor.score)}`}>{factor.score}%</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${factor.score}%` }} transition={{ duration: 1, delay: 0.3 }} className={`h-full rounded-full ${factor.score >= 80 ? 'bg-emerald-500' : factor.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{factor.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-6 rounded-xl bg-[#12121a] border border-white/5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Recommended Actions</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {data.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.02]">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs text-emerald-400 font-medium">{i + 1}</span>
              </div>
              <p className="text-sm text-gray-300">{rec}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
