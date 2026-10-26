import React from 'react';
import { useData } from '../../context/DataContext';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  GitBranch,
  Globe,
  DollarSign,
  Building2,
  ArrowRightLeft,
  Receipt,
  TrendingUp,
  FileText,
  Settings,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'clients'
  | 'projects'
  | 'pipeline'
  | 'fiverr_accounts'
  | 'payoneer_accounts'
  | 'bank_cash'
  | 'transfers'
  | 'expenses'
  | 'analytics'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { user } = useData();
  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'pipeline', label: 'Business Pipeline', icon: GitBranch },
    { id: 'fiverr_accounts', label: 'Fiverr Accounts', icon: Globe },
    { id: 'payoneer_accounts', label: 'Payoneer Accounts', icon: DollarSign },
    { id: 'bank_cash', label: 'Bank & Cash', icon: Building2 },
    { id: 'transfers', label: 'Fund Transfers', icon: ArrowRightLeft },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'analytics', label: 'Analytics & Graphs', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 lg:translate-x-0 border-r border-slate-800 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800 gap-3 bg-slate-950/40">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-sm ring-2 ring-blue-500/30">
            X
          </div>
          <div>
            <div className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5">
              XAVINEX
              <span className="text-[10px] font-bold text-orange-400 bg-orange-950/80 px-1.5 py-0.2 rounded border border-orange-800/60 uppercase">
                {user.role}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium tracking-wide">
              Management System
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom Status */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/30 text-[11px] text-slate-400">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 font-medium">{user.name}</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
          <div className="text-slate-500 truncate text-[10px]">
            Strict Audit Ledger Active
          </div>
        </div>
      </aside>
    </>
  );
};
