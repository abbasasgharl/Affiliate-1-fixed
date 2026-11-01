import React from 'react';
import { ShieldCheck, Lock, ExternalLink, Heart } from 'lucide-react';
import { UserRole } from '../types';

interface FooterProps {
  onOpenFtcModal: () => void;
  onOpenLegalModal: (type: 'privacy' | 'terms' | 'contact') => void;
  onOpenLoginModal: () => void;
  currentUserRole: UserRole;
  onLogout: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenFtcModal,
  onOpenLegalModal,
  onOpenLoginModal,
  currentUserRole,
  onLogout
}) => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-20 pt-12 pb-10 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-slate-200">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">Affiliate<span className="text-indigo-600">OS</span></span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                Partner Deals
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Curated software recommendations, cloud infrastructure deals, and referral promotions. We may earn a commission when you sign up through our links.
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Affiliate links are disclosed on this site</span>
            </div>
          </div>

          {/* Quick Legal Links for Google Ads Compliance */}
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider mb-3">Legal & Compliance</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={onOpenFtcModal}
                  className="hover:text-indigo-600 transition text-slate-600 text-xs cursor-pointer"
                >
                  FTC Affiliate Disclosure
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegalModal('privacy')}
                  className="hover:text-indigo-600 transition text-slate-600 text-xs cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegalModal('terms')}
                  className="hover:text-indigo-600 transition text-slate-600 text-xs cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegalModal('contact')}
                  className="hover:text-indigo-600 transition text-slate-600 text-xs cursor-pointer"
                >
                  Editorial & Contact
                </button>
              </li>
            </ul>
          </div>

          {/* Admin Management Section */}
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider mb-3">Administration</h4>
            <div className="space-y-2">
              {currentUserRole !== 'viewer' ? (
                <div className="space-y-2">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                    Logged in as {currentUserRole === 'super_admin' ? 'Super Admin' : 'Editor'}
                  </span>
                  <button
                    onClick={onLogout}
                    className="block text-xs font-bold text-red-600 hover:text-red-700 transition cursor-pointer"
                  >
                    Sign Out of Admin
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenLoginModal}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition cursor-pointer py-1 font-semibold"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Admin Sign In (Owner Only)</span>
                </button>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                Referral links and campaigns can only be added or modified by authorized administrators.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom copyright notice */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} AffiliateOS. All brand logos and trademarks belong to their respective owners.</p>
          <p className="text-[11px] text-slate-400">Editorial recommendations. We may earn a commission from partner links.</p>
        </div>
      </div>
    </footer>
  );
};
