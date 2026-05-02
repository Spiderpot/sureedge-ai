'use client';

import { motion } from 'framer-motion';
import {
  Zap, Shield, Bot, BarChart3, Bell,
  ArrowRight, CheckCircle2, Star, ChevronRight, Activity, Eye, Brain
} from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const features = [
  { icon: Activity, title: 'Live Odds Comparison', desc: 'Real-time odds from 150+ bookmakers with instant detection of price discrepancies and value opportunities.' },
  { icon: Brain, title: 'AI Surebet Detection', desc: 'Machine learning algorithms scan markets 24/7, identifying profitable arbitrage opportunities before they disappear.' },
  { icon: Bot, title: 'Auto-Bet Execution', desc: 'Automatically place bets across multiple bookmakers simultaneously with precision timing and optimal stake distribution.' },
  { icon: Shield, title: 'Risk Management', desc: 'Advanced bankroll protection with real-time risk scoring, exposure monitoring, and automated stop-loss systems.' },
  { icon: BarChart3, title: 'Profit Analytics', desc: 'Comprehensive performance tracking with detailed charts, ROI analysis, and actionable insights to maximize returns.' },
  { icon: Bell, title: 'Instant Alerts', desc: 'Multi-channel notifications via Telegram, email, and push — never miss a profitable opportunity again.' },
];

const steps = [
  { num: '01', title: 'Connect Bookmakers', desc: 'Link your bookmaker accounts through our secure integration. We support 150+ bookmakers worldwide.' },
  { num: '02', title: 'AI Scans Odds', desc: 'Our AI continuously monitors odds across all connected bookmakers, detecting arbitrage in real-time.' },
  { num: '03', title: 'Place Surebets', desc: 'Receive alerts and auto-execute bets with optimized stakes. Guaranteed profit on every opportunity.' },
  { num: '04', title: 'Collect Profits', desc: 'Track your returns in real-time. Average users see $1,200+ monthly profit with Pro plans.' },
];

const plans = [
  { name: 'Free', price: '$0', period: '/month', cta: 'Start Free Trial', popular: false, features: ['5 surebet scans per day', 'Basic email alerts', 'Manual betting only', 'Single sport filter', 'Community support', 'Basic analytics'] },
  { name: 'Pro', price: '$49', period: '/month', cta: 'Start Pro Trial', popular: true, features: ['Unlimited surebet scans', 'Instant multi-channel alerts', 'Auto-bet execution', 'All sports & markets', 'AI strategy advisor', 'Advanced analytics & export', 'Priority support'] },
  { name: 'Enterprise', price: '$199', period: '/month', cta: 'Contact Sales', popular: false, features: ['Everything in Pro', 'Dedicated account manager', 'Custom API access', 'White-label reports', 'Custom integrations', 'SLA guarantee', 'Multi-user team access'] },
];

const testimonials = [
  { name: 'Marcus T.', role: 'Professional Bettor', text: 'SureEdge AI transformed my betting from break-even to consistent profit. The AI scanner finds opportunities I would never spot manually.', rating: 5 },
  { name: 'Sarah K.', role: 'Sports Trader', text: 'The auto-bet feature is incredible. I set my parameters once and it executes perfectly every time. $3,400 profit last month alone.', rating: 5 },
  { name: 'James R.', role: 'Quantitative Analyst', text: 'The analytics dashboard is best-in-class. Clean data, actionable insights, and the risk management tools keep my bankroll safe.', rating: 5 },
];

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">SureEdge<span className="text-emerald-400"> AI</span></span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
              <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How it Works</a>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onLogin} className="hidden sm:block text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">
                Log in
              </button>
              <button onClick={onLogin} className="text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg transition-colors">
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl" />
        <motion.div {...fadeInUp} className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-emerald-300">AI-Powered Arbitrage Detection</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Profit from Every Bet with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
              AI-Powered Arbitrage
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Automatically detect surebets across 150+ bookmakers. Our AI scans odds in real-time,
            calculates optimal stakes, and executes profitable arbitrage — so you never miss an edge.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onLogin} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </button>
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 text-white font-medium px-8 py-3.5 rounded-xl transition-all">
              <Eye className="w-4 h-4" /> Watch Demo
            </button>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div {...fadeInUp} transition={{ delay: 0.3 }} className="max-w-5xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '10,000+', label: 'Surebets Found Daily' },
            { value: '98.7%', label: 'Accuracy Rate' },
            { value: '$2.4M+', label: 'Profit Generated' },
            { value: '150+', label: 'Bookmakers Monitored' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-4 rounded-xl bg-[#12121a] border border-white/5">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeInUp} className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need to Win</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Powerful tools backed by AI to find and execute profitable surebets automatically.</p>
          </div>
          <motion.div variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeInUp} className="p-6 rounded-2xl bg-[#12121a] border border-white/5 hover:border-emerald-500/20 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0d0d14]">
        <motion.div {...fadeInUp} className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How SureEdge AI Works</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Four simple steps from setup to consistent profit.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div key={step.num} {...fadeInUp} transition={{ delay: i * 0.15 }} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-full h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-400 font-bold text-lg">{step.num}</span>
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeInUp} className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 text-lg">Start free, upgrade when you are ready to scale your profits.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <motion.div key={plan.name} {...fadeInUp} className={`relative p-8 rounded-2xl border ${plan.popular ? 'bg-[#12121a] border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'bg-[#12121a] border-white/5'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-xs font-semibold text-white">Most Popular</div>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={onLogin} className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${plan.popular ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25' : 'border border-white/10 hover:border-white/20 text-white'}`}>
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0d0d14]">
        <motion.div {...fadeInUp} className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Trusted by Professionals</h2>
            <p className="text-gray-400 text-lg">Join thousands of profitable sports traders.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <motion.div key={t.name} {...fadeInUp} className="p-6 rounded-2xl bg-[#12121a] border border-white/5">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeInUp} className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Start Winning?</h2>
          <p className="text-gray-400 text-lg mb-8">Join 15,000+ profitable traders using SureEdge AI. No credit card required.</p>
          <button onClick={onLogin} className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-10 py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 text-lg">
            Get Started Free <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">SureEdge AI</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Contact</span>
          </div>
          <div className="text-sm text-gray-600">&copy; {new Date().getFullYear()} SureEdge AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
