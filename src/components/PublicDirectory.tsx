import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Gift,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  Share2,
  Flame,
  Star
} from 'lucide-react';
import { AffiliateProgram } from '../types';

interface PublicDirectoryProps {
  programs: AffiliateProgram[];
  onSelectProgram: (program: AffiliateProgram) => void;
  onOpenFtcModal: () => void;
  onTrackClick: (programId: string) => void;
}

export const PublicDirectory: React.FC<PublicDirectoryProps> = ({
  programs,
  onSelectProgram,
  onOpenFtcModal,
  onTrackClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'recommended' | 'newest'>('recommended');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    programs.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [programs]);

  // Filter and sort programs
  const visiblePrograms = useMemo(() => {
    return programs
      .filter(p => {
        if (p.status !== 'active') return false;
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.ai_generated_pick.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.ai_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.referral_perk && p.referral_perk.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'recommended') {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          const orderA = typeof a.sort_order === 'number' ? a.sort_order : 999999;
          const orderB = typeof b.sort_order === 'number' ? b.sort_order : 999999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
        }
        return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
      });
  }, [programs, selectedCategory, searchQuery, sortBy]);

  const handleCopyLink = (e: React.MouseEvent, program: AffiliateProgram, linkIndex?: number) => {
    e.stopPropagation();
    const suffix = linkIndex && linkIndex > 1 ? `?link=${linkIndex}` : '';
    const cloakedUrl = `${window.location.origin}/go/${program.cloaked_slug}${suffix}`;
    navigator.clipboard.writeText(cloakedUrl);
    const copyKey = linkIndex ? `${program.id}_${linkIndex}` : program.id;
    setCopiedId(copyKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRedirect = (e: React.MouseEvent, program: AffiliateProgram, linkIndex?: number) => {
    e.stopPropagation();
    const suffix = linkIndex && linkIndex > 1 ? `?link=${linkIndex}` : '';
    // Authoritative click tracking occurs server-side at /go/:slug
    window.open(`/go/${program.cloaked_slug}${suffix}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* FTC Sticky Disclosure Notice Bar */}
      <div className="bg-amber-50/90 border-b border-amber-200/80 py-2.5 px-4 text-center text-xs text-amber-900 flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Affiliate & Partner Disclosure:</strong> These are services we feature as an affiliate partner. When you sign up through our referral links, we may receive a commission at zero additional cost to you.
        </span>
        <button
          onClick={onOpenFtcModal}
          className="underline font-bold text-amber-950 hover:text-indigo-600 transition ml-1 cursor-pointer"
        >
          Read Details
        </button>
      </div>

      {/* Hero Section */}
      <section className="relative pt-12 pb-10 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-bold mb-4 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Curated & Recommended Affiliate Deals</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">
            Hand-Picked Tools & Services <br />
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 bg-clip-text text-transparent">
              Worth Using & Exploring
            </span>
          </h1>

          <p className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            I only recommend services I personally trust and use. Click any program below to claim exclusive referral discounts, extended trials, and bonuses.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-center">
            <div>
              <p className="text-2xl font-black text-slate-900">{programs.length}+</p>
              <p className="text-xs text-slate-500 font-semibold">Recommended Services</p>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-200"></div>
            <div>
              <p className="text-2xl font-black text-emerald-600">100%</p>
              <p className="text-xs text-slate-500 font-semibold">Affiliate Partners</p>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-200"></div>
            <div>
              <p className="text-2xl font-black text-indigo-600">Exclusive</p>
              <p className="text-xs text-slate-500 font-semibold">Referral Perks Included</p>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools, apps, and services (e.g. Cursor, Notion, AI, Marketing)..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 text-sm shadow-sm transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Directory Filter & Controls Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs'
                }`}
              >
                {cat}
                {cat !== 'All' && (
                  <span className="ml-1.5 opacity-70 text-[10px]">
                    ({programs.filter(p => p.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sort:
            </span>
            <select
              aria-label="Sort affiliate programs"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
            >
              <option value="recommended">Top Recommended</option>
              <option value="newest">Recently Added</option>
            </select>
          </div>
        </div>

        {/* Programs Grid */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {visiblePrograms.map((program) => {
            return (
              <div
                key={program.id}
                onClick={() => onSelectProgram(program)}
                className="group relative rounded-3xl bg-white border border-slate-200/90 hover:border-indigo-400 p-5 flex flex-col justify-between transition-all duration-300 hover:shadow-xl shadow-xs cursor-pointer overflow-hidden"
              >
                <div>
                  {/* Visual Banner Cover Image */}
                  <div className="relative h-44 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 mb-4">
                    <img
                      src={program.banner_url || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80'}
                      alt={program.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
                      }}
                    />
                    
                    {/* Top Badges overlay */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide bg-white/95 text-slate-800 shadow-sm border border-slate-200/80">
                        {program.category}
                      </span>
                    </div>

                    {program.featured && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-indigo-600 text-white shadow-md flex items-center gap-1">
                          <Flame className="w-3 h-3 fill-amber-300 text-amber-300" />
                          Featured Deal
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Logo + Title Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={program.logo_url}
                      alt={program.name}
                      className="w-11 h-11 rounded-xl object-contain p-1 border border-slate-200 bg-white shadow-xs"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const letter = encodeURIComponent((program.name || 'P').charAt(0).toUpperCase());
                        img.onerror = null;
                        img.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%234f46e5"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="bold" font-size="30">${letter}</text></svg>`;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors truncate">
                        {program.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 font-medium">Partner</p>
                        <span className="text-slate-300">•</span>
                        <span className="text-[11px] font-bold text-amber-700 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>5.0 ★ Reviews</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Referral Bonus / Perk Pill */}
                  {program.referral_perk && (
                    <div className="mb-3.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/90 flex items-center gap-2">
                      <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-emerald-800 leading-snug">
                        {program.referral_perk}
                      </span>
                    </div>
                  )}

                  {/* AI Generated Pick / Verdict */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 mb-3 group-hover:bg-indigo-50 transition">
                    <div className="flex items-center gap-1.5 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>Why We Recommend It</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                      {program.ai_generated_pick}
                    </p>
                  </div>

                  {/* Short Marketing Description */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                    {program.ai_description}
                  </p>

                  {/* Key points preview */}
                  {program.key_selling_points && program.key_selling_points.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {program.key_selling_points.slice(0, 3).map((point, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{point}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  {/* Link #1 (Primary) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleRedirect(e, program, 1)}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer group-hover:scale-[1.01]"
                    >
                      <span>{program.cta_label || `Try ${program.name} Free`}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleCopyLink(e, program, 1)}
                      title="Copy primary referral link"
                      className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition shrink-0 cursor-pointer"
                    >
                      {copiedId === `${program.id}_1` || copiedId === program.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Additional Links (#2 and #3) if configured */}
                  {program.additional_links && program.additional_links.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {program.additional_links.slice(0, 2).map((subLink, idx) => {
                        const linkNumber = idx + 2;
                        const copyKey = `${program.id}_${linkNumber}`;
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleRedirect(e, program, linkNumber)}
                              className="flex-1 py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span className="truncate">{subLink.label || `${program.name} Link #${linkNumber}`}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </button>
                            <button
                              onClick={(e) => handleCopyLink(e, program, linkNumber)}
                              title={`Copy ${subLink.label || `referral link #${linkNumber}`}`}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition shrink-0 cursor-pointer"
                            >
                              {copiedId === copyKey ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <p className="text-[10px] text-center text-slate-400 pt-0.5">
                    {program.additional_links && program.additional_links.length > 0
                      ? `${1 + program.additional_links.length} official referral links available for ${program.name}`
                      : 'Routes directly through your personal referral link'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {visiblePrograms.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 mt-8 shadow-xs">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900">No Services Found</h3>
            <p className="text-xs text-slate-500 mt-1">Try resetting the category filter or searching for another keyword.</p>
            <button
              onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white transition cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
