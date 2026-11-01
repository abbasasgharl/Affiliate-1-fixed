import React, { useState } from 'react';
import {
  X,
  Save,
  Trash2,
  Gift,
  ExternalLink,
  Flame,
  Plus
} from 'lucide-react';
import { AffiliateProgram, CommissionType, ProgramStatus, ProgramSubLink } from '../types';
import { api } from '../services/api';

interface EditProgramModalProps {
  program: AffiliateProgram | null;
  isOpen: boolean;
  onClose: () => void;
  onProgramUpdated: (updated: AffiliateProgram) => void;
  onProgramDeleted: (id: string) => void;
}

export const EditProgramModal: React.FC<EditProgramModalProps> = ({
  program,
  isOpen,
  onClose,
  onProgramUpdated,
  onProgramDeleted
}) => {
  if (!isOpen || !program) return null;

  const [formData, setFormData] = useState<AffiliateProgram>({ ...program });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const cleanedSubLinks: ProgramSubLink[] = (formData.additional_links || [])
        .filter(l => l && l.url && l.url.trim().length > 0)
        .slice(0, 2)
        .map((l, idx) => {
          let u = l.url.trim();
          if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
          return {
            label: (l.label || '').trim() || `${formData.name} Link ${idx + 2}`,
            url: u
          };
        });

      const updated = await api.updateProgram(program.id, {
        ...formData,
        additional_links: cleanedSubLinks
      });
      onProgramUpdated(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update program');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setErrorMsg(null);
    try {
      await api.deleteProgram(program.id);
      onProgramDeleted(program.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete program');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative text-slate-900 my-8">
        <div className="flex items-center justify-between pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Edit Program: {program.name}</h2>
            <p className="text-xs text-slate-500">Update referral terms, custom images, badges, and marketing descriptions</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Featured / Pin to Top Toggle */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 fill-amber-500 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-900">Feature Program (Keep Pinned at Top)</p>
                <p className="text-[11px] text-slate-600">Featured programs stay at the top of the directory instead of moving down</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={Boolean(formData.featured)}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Service Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
              >
                <option value="AI Tools">AI Tools</option>
                <option value="SaaS & Dev">SaaS & Dev</option>
                <option value="Productivity">Productivity</option>
                <option value="Marketing">Marketing</option>
                <option value="E-Commerce">E-Commerce</option>
                <option value="Finance & Crypto">Finance & Crypto</option>
                <option value="Hosting & Cloud">Hosting & Cloud</option>
                <option value="Security">Security</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Program Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ProgramStatus })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer"
              >
                <option value="active">Active (Visible)</option>
                <option value="needs_review">Needs Review</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          {/* Referral Perk & CTA Button Text */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-emerald-600" />
                Referral Perk / Deal (Shown on Card)
              </label>
              <input
                type="text"
                value={formData.referral_perk || ''}
                onChange={(e) => setFormData({ ...formData, referral_perk: e.target.value })}
                placeholder="e.g. Free 14-Day Trial + 20% Off"
                className="w-full px-3 py-2 rounded-xl bg-emerald-50/50 border border-emerald-300 text-emerald-950 font-medium text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Button CTA Text</label>
              <input
                type="text"
                value={formData.cta_label || ''}
                onChange={(e) => setFormData({ ...formData, cta_label: e.target.value })}
                placeholder="e.g. Try Cursor Free"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cloaked Link Slug</label>
              <div className="flex items-center">
                <span className="px-3 py-2 rounded-l-xl bg-slate-100 text-slate-500 font-mono text-xs border border-r-0 border-slate-300">
                  /go/
                </span>
                <input
                  type="text"
                  required
                  value={formData.cloaked_slug}
                  onChange={(e) => setFormData({ ...formData, cloaked_slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  className="w-full px-3 py-2 rounded-r-xl bg-slate-50 border border-slate-300 text-indigo-700 font-mono text-xs font-bold focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination Referral URL #1 (Primary)</label>
              <input
                type="url"
                required
                value={formData.original_link}
                onChange={(e) => setFormData({ ...formData, original_link: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Up to 3 Referral Links Builder */}
          <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Multiple Referral Links ({1 + (formData.additional_links?.length || 0)} / 3 Links)</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Add up to 3 different referral links for this program to display on its card.
                </p>
              </div>
              {(formData.additional_links?.length || 0) < 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const current = formData.additional_links || [];
                    if (current.length >= 2) return;
                    const nextNum = current.length + 2;
                    setFormData({
                      ...formData,
                      additional_links: [
                        ...current,
                        { label: nextNum === 2 ? 'Special Offer / Link #2' : 'Bonus Deal / Link #3', url: '' }
                      ]
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Link #{(formData.additional_links?.length || 0) + 2}</span>
                </button>
              )}
            </div>

            {formData.additional_links && formData.additional_links.length > 0 && (
              <div className="space-y-2.5 pt-1">
                {formData.additional_links.map((subLink, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Link #{index + 2} Button Label
                      </label>
                      <input
                        type="text"
                        value={subLink.label}
                        onChange={(e) => {
                          const updated = [...(formData.additional_links || [])];
                          updated[index] = { ...updated[index], label: e.target.value };
                          setFormData({ ...formData, additional_links: updated });
                        }}
                        placeholder={`e.g. Claim Deal #${index + 2}`}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                      />
                    </div>
                    <div className="sm:col-span-7">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Link #{index + 2} Referral URL (/go/{formData.cloaked_slug}?link={index + 2})
                      </label>
                      <input
                        type="text"
                        value={subLink.url}
                        onChange={(e) => {
                          const updated = [...(formData.additional_links || [])];
                          updated[index] = { ...updated[index], url: e.target.value };
                          setFormData({ ...formData, additional_links: updated });
                        }}
                        placeholder="https://..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end sm:pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (formData.additional_links || []).filter((_, i) => i !== index);
                          setFormData({ ...formData, additional_links: updated });
                        }}
                        title="Remove this link"
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Logo & Banner URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Banner Image URL</label>
              <input
                type="url"
                value={formData.banner_url || ''}
                onChange={(e) => setFormData({ ...formData, banner_url: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-700 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Why We Recommend It (Verdict Headline)
            </label>
            <input
              type="text"
              value={formData.ai_generated_pick}
              onChange={(e) => setFormData({ ...formData, ai_generated_pick: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Marketing Overview (Shown on Card)
            </label>
            <textarea
              rows={2}
              value={formData.ai_description}
              onChange={(e) => setFormData({ ...formData, ai_description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Review Brief (Shown in Modal)
            </label>
            <textarea
              rows={3}
              value={formData.ai_brief}
              onChange={(e) => setFormData({ ...formData, ai_brief: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
