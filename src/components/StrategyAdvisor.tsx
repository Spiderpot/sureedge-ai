'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Send, TrendingUp, Shield, Lightbulb, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const presetAnalyses = [
  {
    title: 'Current Market Opportunities',
    icon: TrendingUp,
    content: 'Based on current market analysis, there are 3 high-confidence arbitrage opportunities right now:\n\n1. **Premier League** — Man City vs Arsenal: Cross-platform discrepancy detected between Bet365 and Pinnacle. Expected ROI: 4.2%\n\n2. **NBA** — Lakers vs Celtics: Live odds divergence in moneyline market. Expected ROI: 3.1%\n\n3. **ATP Finals** — Djokovic vs Alcaraz: Asian vs European market gap. Expected ROI: 5.8%\n\nRecommendation: Prioritize the Tennis match for highest ROI. Allocate 15% of bankroll across these three opportunities.',
  },
  {
    title: 'Recommended Strategy',
    icon: Shield,
    content: 'Your optimal strategy for the next 24 hours:\n\n1. **Focus on 2-way markets** — Lower variance, more consistent returns\n2. **Target 2-5% ROI surebets** — Sweet spot between frequency and profitability\n3. **Distribute across 5+ bookmakers** — Reduces account restriction risk\n4. **Set session stop-loss at 3%** — Protects bankroll during unfavorable conditions\n\nCurrent bankroll utilization: 42% — well within safe range.',
  },
  {
    title: 'Bankroll Optimization',
    icon: Lightbulb,
    content: 'Bankroll analysis and optimization tips:\n\n• Current monthly ROI: 8.4% — above average\n• Win streak: 12 consecutive profitable days\n• Risk score: 72/100 (Moderate-Low)\n\n**Suggestions:**\n• Consider increasing per-bet allocation by 10% given your consistent win rate\n• Diversify into Tennis and Hockey markets for additional opportunities\n• Set up auto-withdraw at $5,000 profit milestones to secure gains',
  },
];

export default function StrategyAdvisor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your SureEdge AI Strategy Advisor. I can help you analyze market opportunities, optimize your betting strategy, and manage risk. What would you like to know?\n\nYou can ask me anything about arbitrage betting, or click one of the preset analyses below.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: data.data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (analysis: typeof presetAnalyses[0]) => {
    const msg: Message = {
      role: 'assistant',
      content: analysis.content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, msg]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-emerald-400" /> AI Strategy Advisor</h1>
        <p className="text-gray-400 text-sm mt-1">Get AI-powered insights and strategy recommendations</p>
      </div>

      {/* Preset Analysis Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {presetAnalyses.map((analysis) => (
          <motion.button key={analysis.title} whileHover={{ y: -2 }} onClick={() => loadPreset(analysis)} className="p-4 rounded-xl bg-[#12121a] border border-white/5 hover:border-emerald-500/20 text-left transition-all group">
            <analysis.icon className="w-5 h-5 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-sm mb-1">{analysis.title}</h3>
            <p className="text-xs text-gray-500">Click to load analysis</p>
          </motion.button>
        ))}
      </div>

      {/* Chat Interface */}
      <div className="rounded-xl bg-[#12121a] border border-white/5 overflow-hidden flex flex-col" style={{ height: '500px' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                {msg.role === 'user' ? <Send className="w-4 h-4 text-blue-400" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
              </div>
              <div className={`max-w-[80%] p-4 rounded-xl text-sm leading-relaxed whitespace-pre-line ${msg.role === 'user' ? 'bg-blue-500/10 border border-blue-500/10' : 'bg-white/[0.03] border border-white/5'}`}>
                <div className="text-gray-300">{msg.content}</div>
                <div className="text-xs text-gray-600 mt-2">{msg.timestamp}</div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/5 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about arbitrage strategy, market conditions, bankroll management..."
              className="flex-1 bg-[#0a0a0f] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
