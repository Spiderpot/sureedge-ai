'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface LoginPageProps {
  onBack?: () => void;
}

export default function LoginPage({ onBack }: LoginPageProps) {
  const [isLogin, setIsLogin]           = useState(true);
  const [email, setEmail]               = useState('');
  const [name, setName]                 = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const { setUser, setActiveView }      = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body     = isLogin ? { email, password } : { email, name, password };

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Something went wrong');
        return;
      }

      // Always set user from server response — never trust client-side shortcut
      setUser({
        id:    data.data.id,
        email: data.data.email,
        name:  data.data.name || '',
        role:  data.data.role,
      });
      setActiveView('dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Demo: goes through real API — no auth bypass
  const handleDemo = async () => {
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: 'demo@sureedge.ai', password: process.env.NEXT_PUBLIC_DEMO_HINT || '' }),
      });
      const data = await res.json();

      if (!data.success) {
        // Hint: use the login form — credentials in .env SEED_DEMO_PASSWORD
        setError('Demo login: enter demo@sureedge.ai and the demo password to try the platform.');
        setEmail('demo@sureedge.ai');
        return;
      }

      setUser({ id: data.data.id, email: data.data.email, name: data.data.name || '', role: data.data.role });
      setActiveView('dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-2xl overflow-hidden border border-white/5 shadow-2xl">

        {/* Left — Branding */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-emerald-500/10 via-[#12121a] to-[#0a0a0f] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">SureEdge<span className="text-emerald-400"> AI</span></span>
            </div>
            <h2 className="text-3xl font-bold mb-4 leading-tight">
              Start profiting from <span className="text-emerald-400">AI-powered</span> surebet detection
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Real-time arbitrage detection across 30+ bookmakers. AI strategy advisor. Guaranteed-profit calculator.
            </p>
          </div>
          <div className="relative z-10 space-y-4">
            {['Real-time odds scanning', 'Guaranteed arbitrage math', '15-min token security'].map(item => (
              <div key={item} className="flex items-center gap-3 text-sm text-gray-300">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <ArrowRight className="w-3 h-3 text-emerald-400" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right — Form */}
        <div className="p-8 md:p-10 bg-[#12121a]">
          <div className="md:hidden flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">SureEdge<span className="text-emerald-400"> AI</span></span>
            </div>
            {onBack && (
              <button onClick={onBack} className="text-xs text-gray-500 hover:text-white transition-colors">
                &larr; Back
              </button>
            )}
          </div>

          <h3 className="text-2xl font-bold mb-1">{isLogin ? 'Welcome back' : 'Create account'}</h3>
          <p className="text-gray-400 text-sm mb-8">
            {isLogin ? 'Sign in to your SureEdge AI account' : 'Get started with your free account'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Min 8 chars, 1 uppercase, 1 number" required
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isLogin && (
                <p className="mt-1 text-[11px] text-gray-600">At least 8 characters, one uppercase letter, one number</p>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }} type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </motion.button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-emerald-400 hover:text-emerald-300 font-medium">
              {isLogin ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          {/* Demo button — authenticates via real API, no bypass */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <button onClick={handleDemo} disabled={loading}
              className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Try demo account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
