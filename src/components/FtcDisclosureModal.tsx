import React from 'react';
import { X, ShieldAlert, CheckCircle, Scale } from 'lucide-react';

interface FtcDisclosureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FtcDisclosureModal: React.FC<FtcDisclosureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative text-slate-900 overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">FTC Affiliate & Referral Disclosure</h2>
              <p className="text-xs text-slate-500">16 CFR Part 255 Guidelines Compliance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 text-xs leading-relaxed text-slate-700 max-h-[70vh] overflow-y-auto pr-1">
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
            <p className="font-bold text-amber-950 mb-1">Simple Transparency Summary:</p>
            <p className="text-amber-900 leading-relaxed">
              We participate in referral and affiliate partner programs. When you click through our referral links (<code className="text-indigo-700 bg-white px-1.5 py-0.5 rounded font-bold font-mono">/go/slug</code>) and subscribe or make a purchase, we may receive a commission. <strong className="text-slate-900 font-extrabold">This comes at zero additional cost to you</strong>, and often grants you special promotional pricing or extended trials.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              How Link Tracking Works
            </h3>
            <p className="text-slate-600">
              Links on this site route through our safe gateway (e.g. <code className="text-slate-800 font-semibold font-mono">/go/tool</code>) before forwarding you to the official partner. This allows us to track link health, detect broken affiliate URLs, and verify that the destination remains safe.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              Independent Recommendations
            </h3>
            <p className="text-slate-600">
              We only promote and highlight services that we consider genuinely valuable, robust, and dependable. Our ratings and picks reflect honest assessments of product utility and user feedback.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition shadow-sm cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
