import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PublicDirectory } from './components/PublicDirectory';
import { AdminPortal } from './components/AdminPortal';
import { ProgramDetailModal } from './components/ProgramDetailModal';
import { AddProgramModal } from './components/AddProgramModal';
import { EditProgramModal } from './components/EditProgramModal';
import { FtcDisclosureModal } from './components/FtcDisclosureModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { Footer } from './components/Footer';
import { AdminLoginModal } from './components/AdminLoginModal';
import { LegalModals } from './components/LegalModals';
import { AffiliateProgram, UserRole } from './types';
import { getConsent } from './services/consent';
import { api } from './services/api';

export default function App() {
  const [programs, setPrograms] = useState<AffiliateProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'public' | 'admin'>('public');

  // Authentication State: By default, public visitors are 'viewer'
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(() => {
    return (localStorage.getItem('affiliateos_admin_role') as UserRole) || 'viewer';
  });

  // Modals state
  const [selectedProgram, setSelectedProgram] = useState<AffiliateProgram | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AffiliateProgram | null>(null);
  const [isFtcModalOpen, setIsFtcModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | 'contact' | null>(null);
  const [toastNotification, setToastNotification] = useState<{
    title: string;
    subtitle: string;
    slug?: string;
  } | null>(null);
  const [copiedToastSlug, setCopiedToastSlug] = useState(false);

  // Load programs on initial mount, track visitor, and verify active admin session
  useEffect(() => {
    if (getConsent() === 'accepted') api.recordVisitor();

    // Verify session
    api.getMe().then((user) => {
      if (user) {
        setCurrentUserRole(user.role);
      } else {
        setCurrentUserRole('viewer');
      }
    });

    const fetchPrograms = async () => {
      try {
        const data = await api.getPrograms();
        setPrograms(data);

        // Check if URL pathname points to a specific program slug
        const path = window.location.pathname;
        if (path.startsWith('/program/') || path.startsWith('/p/')) {
          const slug = path.split('/')[2];
          const found = data.find(p => p.cloaked_slug === slug);
          if (found) setSelectedProgram(found);
        }
      } catch (err) {
        console.error('Failed to load programs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrograms();
  }, []);

  const handleLoginSuccess = (role: UserRole) => {
    setCurrentUserRole(role);
    setCurrentView('admin'); // switch to admin hub on login
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUserRole('viewer');
    setCurrentView('public');
  };

  const handleProgramAdded = (newProgram: AffiliateProgram) => {
    setPrograms(prev => [newProgram, ...prev.filter(p => p.id !== newProgram.id)]);
    api.getPrograms().then(fresh => {
      if (fresh && fresh.length > 0) setPrograms(fresh);
    });
    setToastNotification({
      title: `Referral Program Added: ${newProgram.name}`,
      subtitle: `Published and live on the main directory at /go/${newProgram.cloaked_slug}`,
      slug: newProgram.cloaked_slug
    });
    setTimeout(() => {
      setToastNotification(prev => (prev?.slug === newProgram.cloaked_slug ? null : prev));
    }, 8000);
  };

  const handleProgramUpdated = (updated: AffiliateProgram) => {
    setPrograms(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (selectedProgram && selectedProgram.id === updated.id) {
      setSelectedProgram(updated);
    }
    setToastNotification({
      title: `Program Updated: ${updated.name}`,
      subtitle: `Changes saved for /go/${updated.cloaked_slug}`,
      slug: updated.cloaked_slug
    });
    setTimeout(() => setToastNotification(null), 5000);
  };

  const handleProgramDeleted = (id: string) => {
    setPrograms(prev => prev.filter(p => p.id !== id));
    if (selectedProgram && selectedProgram.id === id) {
      setSelectedProgram(null);
    }
    setToastNotification({
      title: 'Referral Program Removed',
      subtitle: 'The program has been deleted from the directory.'
    });
    setTimeout(() => setToastNotification(null), 4000);
  };

  const handleTrackClick = async (programId: string) => {
    await api.trackClientClick(programId);
  };

  const needsReviewCount = programs.filter(p => p.status === 'needs_review' || p.status === 'manual_needed').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Navigation Header */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        currentUserRole={currentUserRole}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        onOpenFtcModal={() => setIsFtcModalOpen(true)}
        onOpenContactModal={() => setActiveLegalModal('contact')}
        needsReviewCount={needsReviewCount}
      />

      {/* Global Confirmation Toast Banner */}
      {toastNotification && (
        <div className="bg-emerald-600 text-white px-4 py-3 shadow-lg border-b border-emerald-700 sticky top-16 z-40 animate-fade-in">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-emerald-700 font-black text-xs shrink-0">
                ✓
              </span>
              <div>
                <p className="text-xs sm:text-sm font-extrabold">{toastNotification.title}</p>
                <p className="text-[11px] text-emerald-100">{toastNotification.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {toastNotification.slug && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/go/${toastNotification.slug}`);
                    setCopiedToastSlug(true);
                    setTimeout(() => setCopiedToastSlug(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer"
                >
                  {copiedToastSlug ? '✓ Copied Link!' : 'Copy /go/ Link'}
                </button>
              )}
              {currentView === 'admin' && (
                <button
                  onClick={() => setCurrentView('public')}
                  className="px-3 py-1.5 rounded-lg bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-extrabold transition cursor-pointer"
                >
                  View on Main Page →
                </button>
              )}
              <button
                onClick={() => setToastNotification(null)}
                className="px-2 py-1 rounded-lg hover:bg-emerald-700 text-emerald-100 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View: Visitors see PublicDirectory; Admins can toggle between Public and Admin Hub */}
      <main className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-500 font-semibold">Loading Curated Software Directory...</p>
            </div>
          </div>
        ) : currentView === 'public' || currentUserRole === 'viewer' ? (
          <PublicDirectory
            programs={programs}
            onSelectProgram={setSelectedProgram}
            onOpenFtcModal={() => setIsFtcModalOpen(true)}
            onTrackClick={handleTrackClick}
          />
        ) : (
          <AdminPortal
            programs={programs}
            onProgramsUpdated={setPrograms}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenEditModal={(p) => setEditingProgram(p)}
            currentUserRole={currentUserRole}
            onRoleChange={setCurrentUserRole}
          />
        )}
      </main>

      {/* Trust & Legal Footer with Google Ads Compliance Links */}
      <Footer
        onOpenFtcModal={() => setIsFtcModalOpen(true)}
        onOpenLegalModal={setActiveLegalModal}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        currentUserRole={currentUserRole}
        onLogout={handleLogout}
      />

      {/* Program Deep-Dive Landing Modal (Monetization Surface) */}
      <ProgramDetailModal
        program={selectedProgram}
        onClose={() => setSelectedProgram(null)}
        onTrackClick={handleTrackClick}
      />

      {/* Add Program Modal: Only accessible when logged in as admin */}
      {(currentUserRole === 'super_admin' || currentUserRole === 'editor') && (
        <AddProgramModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onProgramAdded={handleProgramAdded}
          existingPrograms={programs}
        />
      )}

      {/* Edit Program Modal */}
      <EditProgramModal
        isOpen={!!editingProgram}
        program={editingProgram}
        onClose={() => setEditingProgram(null)}
        onProgramUpdated={handleProgramUpdated}
        onProgramDeleted={handleProgramDeleted}
      />

      {/* FTC Affiliate Compliance Modal */}
      <FtcDisclosureModal
        isOpen={isFtcModalOpen}
        onClose={() => setIsFtcModalOpen(false)}
      />

      {/* Admin Sign In Modal */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Legal Modals: Privacy Policy, Terms of Service, Contact */}
      <LegalModals
        type={activeLegalModal}
        onClose={() => setActiveLegalModal(null)}
        programs={programs}
      />

      {/* GDPR / Click Analytics Cookie Banner */}
      <CookieConsentBanner />
    </div>
  );
}
