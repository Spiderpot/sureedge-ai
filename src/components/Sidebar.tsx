'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Search, Activity, Calculator, Wallet, ShieldAlert,
  BarChart3, Brain, Bot, Bell, Settings, ChevronLeft, ChevronRight, LogOut, Zap
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scanner', label: 'Surebet Scanner', icon: Search },
  { id: 'live-odds', label: 'Live Odds', icon: Activity },
  { id: 'calculator', label: 'Stake Calculator', icon: Calculator },
  { id: 'bankroll', label: 'Bankroll', icon: Wallet },
  { id: 'risk', label: 'Risk Monitor', icon: ShieldAlert },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'advisor', label: 'AI Advisor', icon: Brain },
  { id: 'auto-bet', label: 'Auto-Bet', icon: Bot },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { activeView, setActiveView, user, sidebarCollapsed, setSidebarCollapsed, clearUser } = useAppStore();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearUser();
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarCollapsed === false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        className={`fixed top-0 left-0 h-full z-50 bg-[#0a0a0f] border-r border-white/5 flex flex-col transition-transform duration-300 ${
          sidebarCollapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0 w-64'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/5">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-lg font-bold whitespace-nowrap">
                SureEdge<span className="text-emerald-400"> AI</span>
              </motion.span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 items-center justify-center"
          >
            {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                {!sidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-white/5 p-3">
          {!sidebarCollapsed && user && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-white/5">
              <div className="text-sm font-medium truncate">{user.name || user.email}</div>
              <div className="text-xs text-gray-500">{user.role}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span>Log out</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
