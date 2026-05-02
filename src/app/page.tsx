'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, RefreshCw, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import LandingPage from '@/components/LandingPage';
import LoginPage from '@/components/LoginPage';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import SurebetScanner from '@/components/SurebetScanner';
import LiveOdds from '@/components/LiveOdds';
import StakeCalculator from '@/components/StakeCalculator';
import BankrollManager from '@/components/BankrollManager';
import RiskMonitor from '@/components/RiskMonitor';
import Analytics from '@/components/Analytics';
import StrategyAdvisor from '@/components/StrategyAdvisor';
import AutoBet from '@/components/AutoBet';
import Alerts from '@/components/Alerts';
import Settings from '@/components/Settings';

const viewComponents: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  scanner: SurebetScanner,
  'live-odds': LiveOdds,
  calculator: StakeCalculator,
  bankroll: BankrollManager,
  risk: RiskMonitor,
  analytics: Analytics,
  advisor: StrategyAdvisor,
  'auto-bet': AutoBet,
  alerts: Alerts,
  settings: Settings,
};

export default function Home() {
  const {
    user,
    isAuthenticated,
    setUser,
    clearUser,
    activeView,
    setActiveView,
    mobileMenuOpen,
    setMobileMenuOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useAppStore();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setUser({
              id: data.data.id,
              email: data.data.email,
              name: data.data.name || '',
              role: data.data.role,
            });
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, [setUser]);

  const _handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    clearUser();
  }, [clearUser]);

  // Loading screen
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white tracking-tight">SureEdge AI</span>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Loading platform...</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Landing page for non-authenticated users
  if (!isAuthenticated || !user) {
    if (showAuth) {
      return <LoginPage onBack={() => setShowAuth(false)} />;
    }
    return <LandingPage onLogin={() => setShowAuth(true)} />;
  }

  // Main dashboard layout
  const ActiveComponent = viewComponents[activeView] || Dashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f] text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        {/* Top Header */}
        <header className="h-14 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex w-9 h-9 rounded-lg items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-white capitalize">
              {activeView.replace(/-/g, ' ')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-[8px] font-bold text-white flex items-center justify-center">3</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <span className="text-xs font-bold text-emerald-400">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-white leading-tight">{user.name || user.email}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{user.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer */}
        <footer className="h-8 border-t border-white/5 bg-[#0a0a0f]/50 flex items-center justify-between px-4 text-[10px] text-gray-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-500" />
              <span className="font-medium text-gray-400">SureEdge AI</span>
            </div>
            <span>v2.4.1</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>All systems operational</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
