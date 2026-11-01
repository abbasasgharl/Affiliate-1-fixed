import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Gift,
  Copy,
  Check,
  Star,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  Send,
  Loader2,
  ThumbsUp,
  User
} from 'lucide-react';
import { AffiliateProgram, UserReview } from '../types';
import { api } from '../services/api';

interface ProgramDetailModalProps {
  program: AffiliateProgram | null;
  onClose: () => void;
  onTrackClick: (programId: string) => void;
}

export const ProgramDetailModal: React.FC<ProgramDetailModalProps> = ({
  program,
  onClose,
  onTrackClick
}) => {
  const [copied, setCopied] = useState(false);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    if (program?.id) {
      loadReviews(program.id);
      setShowReviewForm(false);
      setReviewSuccess(false);
    }
  }, [program?.id]);

  const loadReviews = async (programId: string) => {
    setLoadingReviews(true);
    try {
      const data = await api.getReviews(programId);
      setReviews(data);
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program || !reviewName.trim() || !reviewComment.trim()) {
      setReviewError('Please provide your name and your honest feedback.');
      return;
    }
    setSubmittingReview(true);
    setReviewError('');
    try {
      const newRev = await api.submitReview({
        program_id: program.id,
        user_name: reviewName.trim(),
        user_email: reviewEmail.trim() || undefined,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim()
      });
      setReviews(prev => [newRev, ...prev]);
      setReviewSuccess(true);
      setShowReviewForm(false);
      setReviewName('');
      setReviewEmail('');
      setReviewTitle('');
      setReviewComment('');
      setReviewRating(5);
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!program) return null;

  const cloakedUrl = `${window.location.origin}/go/${program.cloaked_slug}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(cloakedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCtaClick = () => {
    // Authoritative click tracking occurs server-side at /go/:slug
    window.open(`/go/${program.cloaked_slug}`, '_blank', 'noopener,noreferrer');
  };

  const approvedReviews = reviews.filter(r => r.status === 'approved');
  const averageRating = approvedReviews.length > 0
    ? (approvedReviews.reduce((acc, r) => acc + r.rating, 0) / approvedReviews.length).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative text-slate-900 my-8 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 text-slate-500 hover:text-slate-900 p-2 rounded-xl bg-white/90 hover:bg-slate-100 transition shadow-xs cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cover Banner Image */}
        {program.banner_url && (
          <div className="h-44 sm:h-52 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6 relative overflow-hidden bg-slate-100">
            <img
              src={program.banner_url}
              alt={program.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <img
              src={program.logo_url}
              alt={program.name}
              className="w-16 h-16 rounded-2xl object-contain p-1 border border-slate-200 shadow-sm bg-white"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                const letter = encodeURIComponent((program.name || 'P').charAt(0).toUpperCase());
                img.onerror = null;
                img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%234f46e5"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold" font-size="30">${letter}</text></svg>`;
              }}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{program.name}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Partner Service
                </span>
                {averageRating ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {averageRating} ({approvedReviews.length} {approvedReviews.length === 1 ? 'review' : 'reviews'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                    No reviews yet
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Category: <strong className="text-slate-800">{program.category}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-5">
          {/* Referral Perk Callout */}
          {program.referral_perk && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <Gift className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">
                  Exclusive Referral Deal
                </span>
                <p className="text-sm font-bold text-emerald-950">
                  {program.referral_perk}
                </p>
              </div>
            </div>
          )}

          {/* AI Recommendation Verdict Highlight */}
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
            <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold text-xs uppercase tracking-wider mb-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Why We Recommend It</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              {program.ai_generated_pick}
            </p>
          </div>

          {/* Marketing Description */}
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Overview</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {program.ai_description}
            </p>
          </div>

          {/* Comprehensive Review Brief */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <h3 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Detailed Review & Assessment
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {program.ai_brief}
            </p>
            {program.target_audience && (
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">Best Suited For:</span>
                <span className="text-slate-800 font-bold">{program.target_audience}</span>
              </div>
            )}
          </div>

          {/* Key Selling Points */}
          {program.key_selling_points && program.key_selling_points.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Key Reasons to Sign Up</h3>
              <div className="space-y-2">
                {program.key_selling_points.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="font-medium">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Reviews & Ratings Section */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">User Reviews & Experiences</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700">
                  {reviews.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReviewForm(prev => !prev);
                  setReviewSuccess(false);
                }}
                className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition hover:underline"
              >
                {showReviewForm ? 'Cancel' : '+ Leave a Review'}
              </button>
            </div>

            {/* Review Success Banner */}
            {reviewSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Thank you! Your review has been submitted for moderation and will appear once approved.</span>
              </div>
            )}

            {/* Leave a Review Interactive Form */}
            {showReviewForm && (
              <form onSubmit={handleReviewSubmit} className="mb-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-fade-in text-xs">
                <h4 className="font-extrabold text-slate-900 text-xs">Share Your Experience with {program.name}</h4>
                {reviewError && (
                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px]">
                    {reviewError}
                  </div>
                )}

                {/* Rating selection (1-5 stars) */}
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Your Rating *</label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating || reviewRating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setReviewRating(star)}
                          className="p-1 cursor-pointer transition hover:scale-110"
                        >
                          <Star className={`w-5 h-5 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                        </button>
                      );
                    })}
                    <span className="text-xs font-bold text-slate-700 ml-1">
                      {reviewRating} of 5 Stars
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      placeholder="e.g. Michael S."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={reviewEmail}
                      onChange={(e) => setReviewEmail(e.target.value)}
                      placeholder="michael@example.com"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Headline / Summary</label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="e.g. Great speed & best customer support"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Review Details *</label>
                  <textarea
                    rows={3}
                    required
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="What did you like about using this software or service? How did it help your workflow?"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {submittingReview ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit User Review</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Reviews List */}
            {loadingReviews ? (
              <div className="text-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
              </div>
            ) : approvedReviews.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <p className="text-xs text-slate-500">No approved reviews yet.</p>
                <button
                  type="button"
                  onClick={() => setShowReviewForm(true)}
                  className="mt-1.5 text-xs font-bold text-indigo-600 hover:underline"
                >
                  Be the first to review {program.name}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {approvedReviews.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                          {rev.user_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-extrabold text-slate-900">{rev.user_name}</span>
                        {rev.verified ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified Customer
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            Community Review
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {rev.title && (
                      <h5 className="font-bold text-slate-800 text-xs">
                        &quot;{rev.title}&quot;
                      </h5>
                    )}
                    <p className="text-slate-600 leading-relaxed text-xs">
                      {rev.comment}
                    </p>
                    <div className="text-[10px] text-slate-400 pt-0.5">
                      {new Date(rev.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cloaked Shareable Link Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">My Personal Referral Link</span>
              <code className="text-xs text-indigo-700 font-mono select-all break-all font-semibold">
                {cloakedUrl}
              </code>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Primary High-Converting CTA Button & Additional Links */}
          <div className="pt-2 space-y-2.5">
            <button
              onClick={handleCtaClick}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-extrabold text-base transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>{program.cta_label || `Visit Official ${program.name} Referral Site`}</span>
              <ExternalLink className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {program.additional_links && program.additional_links.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {program.additional_links.slice(0, 2).map((sub, idx) => (
                  <button
                    key={idx}
                    onClick={() => window.open(`/go/${program.cloaked_slug}?link=${idx + 2}`, '_blank', 'noopener,noreferrer')}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{sub.label || `${program.name} Link #${idx + 2}`}</span>
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-center text-slate-400 mt-2">
              FTC Disclosure: Clicking this link routes to the official partner page. We may receive a referral commission at zero additional cost to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
