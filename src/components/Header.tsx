import React from 'react';
import {
  Link2,
  ShieldCheck,
  Zap,
  LayoutGrid,
  Settings,
  Lock,
  LogOut,
  FileText,
  Mail
} from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  currentView: 'public' | 'admin';
  onViewChange: (view: 'public' | 'admin') => void;
  currentUserRole: UserRole;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  onOpenAddModal: () => void;
  onOpenFtcModal: () => void;
  onOpenContactModal: () => void;
  needsReviewCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  currentUserRole,
  onOpenLoginModal,
  onLogout,
  onOpenAddModal,
  onOpenFtcModal,
  onOpenContactModal,
  needsReviewCount
}) => {
  const isAdmin = currentUserRole === 'super_admin' || currentUserRole === 'editor';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onViewChange('public')}
              className="flex items-center gap-2.5 text-left group transition-transform focus:outline-none cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-all">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg text-slate-900 tracking-tight">Affiliate<span className="text-indigo-600">OS</span></span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Partner Deals
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">Curated Referral Directory</p>
              </div>
            </button>

            {/* If Admin is logged in, show Navigation Switcher */}
            {isAdmin && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => onViewChange('public')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentView === 'public'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Public View</span>
                </button>
                <button
                  onClick={() => onViewChange('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer relative ${
                    currentView === 'admin'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Admin Hub</span>
                  {needsReviewCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {needsReviewCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* If Admin is logged in: show "+ Add Referral Link" */}
            {isAdmin ? (
              <>
                <button
                  onClick={onOpenAddModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm hover:shadow-md cursor-pointer"
                  title="Only admins can add referral links"
                >
                  <Zap className="w-3.5 h-3.5 fill-white/20" />
                  <span>+ Add Referral Link</span>
                </button>

                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 text-xs text-emerald-800 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Admin: {currentUserRole === 'super_admin' ? 'Abbas' : 'Editor'}</span>
                  <button
                    onClick={onLogout}
                    title="Sign out of admin session"
                    className="text-slate-500 hover:text-red-600 ml-1 p-0.5 rounded cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              /* Public Visitor view: clean, trust-building, no edit buttons */
              <>
                <button
                  onClick={onOpenContactModal}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer font-semibold"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contact</span>
                </button>

                <button
                  onClick={onOpenFtcModal}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Disclosure</span>
                </button>

                <button
                  onClick={onOpenLoginModal}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 transition cursor-pointer font-bold shadow-2xs"
                  title="Restricted area for site administrator"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Sign In</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
