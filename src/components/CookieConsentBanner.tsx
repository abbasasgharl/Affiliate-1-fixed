import React, { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { getConsent, setConsent, loadAnalytics } from '../services/consent';

export const CookieConsentBanner: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = getConsent();
    if (consent === 'accepted') loadAnalytics();
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    setConsent('accepted');
    setShow(false);
  };

  const handleDecline = () => {
    setConsent('declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 animate-slide-up">
      <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xl text-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Privacy & Referral Analytics</h4>
              <button
                onClick={() => setShow(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              We use anonymized click data to track referral links and verify destination endpoints. We do not sell or share personal information.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleAccept}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition shadow-2xs cursor-pointer"
              >
                Accept
              </button>
              <button
                onClick={handleDecline}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Essential Only
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
