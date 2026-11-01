import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldCheck, Mail, Key, Eye, EyeOff, Loader2, AlertCircle, UserCheck } from 'lucide-react';
import { UserRole } from '../types';
import { api } from '../services/api';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: UserRole) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSetupStatus().then((status) => {
        setIsSetupMode(status.setupRequired);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your admin email address.');
      return;
    }
    if (!password) {
      setError('Please enter your admin password.');
      return;
    }

    if (isSetupMode) {
      if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        setError('Password must be at least 12 characters and include upper-case, lower-case and a number.');
        return;
      }
      if (!setupToken.trim()) {
        setError('Enter the SETUP_TOKEN configured on the server.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify your password confirmation.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSetupMode) {
        const data = await api.setupAdmin(email.trim(), password, name.trim(), setupToken.trim());
        onLoginSuccess(data.user.role);
        onClose();
      } else {
        const data = await api.login(email.trim(), password);
        onLoginSuccess(data.user.role);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-slate-900">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            {isSetupMode ? <UserCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-black text-slate-900">
            {isSetupMode ? 'Initial Administrator Setup' : 'Admin Portal Sign In'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isSetupMode
              ? 'Secure first-run setup: Create your personal primary administrator password.'
              : 'Restricted area. Please sign in with your administrator email and password.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSetupMode && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Setup Token (SETUP_TOKEN env var) *</label>
              <input
                type="password"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                autoComplete="off"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white font-mono"
              />
            </div>
          )}
          {isSetupMode && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Administrator Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Admin Email *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isSetupMode ? 'Set Strong Password (min 12 chars) *' : 'Password *'}
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSetupMode ? 'Create strong administrator password' : 'Enter admin password'}
                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isSetupMode && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold text-xs transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isSetupMode ? 'Configuring Account...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSetupMode ? 'Create Administrator & Enter' : 'Sign In as Admin'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-5 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
          <p className="text-[10px] text-slate-400 mt-0.5">
            PostgreSQL authenticated session with server-side revocation
          </p>
        </div>
      </div>
    </div>
  );
};
