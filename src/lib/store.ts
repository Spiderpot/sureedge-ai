import { create } from 'zustand';

interface AppState {
  user: { id: string; email: string; name: string; role: string } | null;
  isAuthenticated: boolean;
  activeView: string;
  mobileMenuOpen: boolean;
  sidebarCollapsed: boolean;
  setUser: (user: AppState['user']) => void;
  clearUser: () => void;
  setActiveView: (view: string) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  activeView: 'dashboard',
  mobileMenuOpen: false,
  sidebarCollapsed: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearUser: () => set({ user: null, isAuthenticated: false, activeView: 'dashboard' }),
  setActiveView: (view) => set({ activeView: view, mobileMenuOpen: false }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
