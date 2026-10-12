import React, { useState } from 'react';
import { X, Lock, Mail, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { User, Business } from '../types';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, business: Business) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sinkronisasi tombol Back browser/HP agar menutup modal dan tidak keluar web
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  const handleSafeClose = () => {
    if (window.location.hash === '#login') {
      window.history.back();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const data = await api.login(email.trim(), password);
      onLoginSuccess(data.user, data.business);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Email atau password salah.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-neutral-800 border border-neutral-100">
        <button
          type="button"
          onClick={handleSafeClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition cursor-pointer p-1"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Portal Pengelola Bisnis</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Masuk ke Admin Dashboard untuk mengelola produk, pesanan, dan tampilan toko.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Email Pemilik / Admin
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                autoComplete="off"
                placeholder="nama@bisnis.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs pl-9 pr-10 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer p-1"
                title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-amber-800 hover:bg-amber-900 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 transition cursor-pointer text-xs disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memverifikasi Akun...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Masuk ke Dashboard
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
