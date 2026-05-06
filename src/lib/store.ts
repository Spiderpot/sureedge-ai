import { create } from 'zustand';

export interface SurebetOutcome {
  outcome: string;
  odds: number;
  bookmaker: string;
  bookmakerKey?: string;
  impliedProb?: number;
}

export interface SelectedSurebet {
  id: string;
  match: string;
  sport: string;
  league: string;
  arbPercentage: number;
  isGenuineArb: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  outcomes: SurebetOutcome[];
  expiresAt: string;
}

interface AppState {
  user: { id: string; email: string; name: string; role: string } | null;
  isAuthenticated: boolean;
  activeView: string;
  mobileMenuOpen: boolean;
  sidebarCollapsed: boolean;
  selectedSurebet: SelectedSurebet | null;
  setUser: (user: AppState['user']) => void;
  clearUser: () => void;
  setActiveView: (view: string) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedSurebet: (sb: SelectedSurebet | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  activeView: 'dashboard',
  mobileMenuOpen: false,
  sidebarCollapsed: false,
  selectedSurebet: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearUser: () => set({ user: null, isAuthenticated: false, activeView: 'dashboard', selectedSurebet: null }),
  setActiveView: (view) => set({ activeView: view, mobileMenuOpen: false }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedSurebet: (sb) => set({ selectedSurebet: sb }),
}));
