import React, { useState } from 'react';
import { X, ShieldCheck, Mail, FileText, CheckCircle, Send, Loader2, Sparkles } from 'lucide-react';
import { AffiliateProgram } from '../types';
import { api } from '../services/api';

interface LegalModalProps {
  type: 'privacy' | 'terms' | 'contact' | null;
  onClose: () => void;
  programs?: AffiliateProgram[];
}

export const LegalModals: React.FC<LegalModalProps> = ({ type, onClose, programs = [] }) => {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactProgramId, setContactProgramId] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!type) return null;

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) {
      setErrorMessage('Please fill in your name, email, and message.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      await api.sendContactMessage({
        name: contactName,
        email: contactEmail,
        subject: contactSubject || 'Visitor Inquiry via Contact Form',
        message: contactMessage,
        program_id: contactProgramId || undefined
      });
      setSubmitted(true);
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative text-slate-900 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Privacy Policy */}
        {type === 'privacy' && (
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Privacy Policy</h2>
                <p className="text-xs text-slate-500">Google Ads & GDPR/CCPA Compliant Standard</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 max-h-[65vh] overflow-y-auto pr-1 leading-relaxed">
              <p>
                <strong>Last Updated: October 2026</strong>
              </p>
              <p>
                We value your privacy. This Privacy Policy details how AffiliateOS handles visitor data when you browse our software reviews and click referral links.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">1. Data We Collect</h4>
              <p>
                We only collect non-personally identifiable telemetry when a referral redirect is triggered. This includes your hashed IP address (SHA-256 for privacy compliance), browser device type (desktop/mobile), timestamp, and referring URL.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">2. Cookies and Tracking</h4>
              <p>
                We use functional cookies to remember your consent preferences and ensure partner referral tracking functions accurately. When you click a partner link, the destination merchant (e.g. Plesk, Nexcess, Cursor) may set an affiliate attribution cookie.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">3. No Sale of Personal Data</h4>
              <p>
                We never sell, rent, or trade your personal information to third parties or data brokers.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">4. Contact</h4>
              <p>
                Questions regarding privacy may be directed to <code className="text-indigo-700 font-semibold">abbas.aj@gmail.com</code>.
              </p>
            </div>
          </div>
        )}

        {/* Terms of Service */}
        {type === 'terms' && (
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Terms of Service</h2>
                <p className="text-xs text-slate-500">Website Usage & Partner Terms</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 max-h-[65vh] overflow-y-auto pr-1 leading-relaxed">
              <p>
                <strong>Last Updated: October 2026</strong>
              </p>
              <p>
                By accessing this directory, you agree to these Terms of Service. All content, recommendations, and reviews are provided for informational and promotional guidance.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">1. Referral Links & Pricing</h4>
              <p>
                Links on this directory route to external partner websites. While we strive to verify pricing and discounts, partner promotions and terms may be updated by the merchants at any time.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">2. Disclaimer of Warranties</h4>
              <p>
                All reviews and information are provided on an &quot;as is&quot; basis without warranty of any kind. You should conduct your own due diligence before purchasing any software license or service.
              </p>
              <h4 className="font-bold text-slate-900 text-sm">3. Intellectual Property</h4>
              <p>
                Product logos and brand trademarks belong to their respective owners (e.g. Plesk, Nexcess, Notion, Cursor, Shopify).
              </p>
            </div>
          </div>
        )}

        {/* Contact & Editorial Standards */}
        {type === 'contact' && (
          <div>
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Contact Admin & Suggest Referral</h2>
                <p className="text-xs text-slate-500">Instant notification dispatched to site owner</p>
              </div>
            </div>

            {submitted ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black text-emerald-900">Message Delivered Successfully!</h3>
                <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                  Thank you! Your message has been received. We typically respond within 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="inline-block mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3 text-xs">
                {errorMessage && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Alex Taylor"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Your Email Address *</label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="alex@company.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Subject</label>
                    <input
                      type="text"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="e.g. Question about Nexcess coupon"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Related Program (Optional)</label>
                    <select
                      value={contactProgramId}
                      onChange={(e) => setContactProgramId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">General Inquiry / Directory Feedback</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Message *</label>
                  <textarea
                    rows={3}
                    required
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Tell us about a referral program you'd like added, report a broken link, or ask a question..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Admin alerted instantly via Email on submit</span>
                  </div>
                  <span className="text-slate-400">Direct: abbas.aj@gmail.com</span>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Message to Admin</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {type !== 'contact' && (
          <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
