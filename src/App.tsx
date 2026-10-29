import React, { useState, useEffect } from 'react';
import { PublicCatalogPage } from './pages/PublicCatalogPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { User, Business } from './types';
import { api } from './services/api';

export default function App() {
  const [viewMode, setViewMode] = useState<'public' | 'admin'>('public');
  const [currentSlug, setCurrentSlug] = useState<string>('kavarna-coffeegit');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    initApp();

    // Pastikan halaman awal memiliki state agar tombol Back browser tidak langsung keluar dari web
    if (!window.history.state) {
      window.history.replaceState({ page: 'public' }, '', window.location.href);
    }

    // Listener tombol Back browser / gesture HP agar kembali ke halaman sebelumnya dan TIDAK KELUAR dari web
    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash === '#admin') {
        const token = localStorage.getItem('umkm_auth_token');
        if (token) {
          setViewMode('admin');
        } else {
          setIsLoginModalOpen(true);
        }
      } else if (hash === '#login') {
        setIsLoginModalOpen(true);
      } else {
        // Jika kembali dari admin atau modal, kembalikan ke katalog buku menu
        setIsLoginModalOpen(false);
        setViewMode('public');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const initApp = async () => {
    try {
      // 1. Ambil info bisnis yang ada di server
      const bizList = await api.getBusinesses();

      const pathMatch = window.location.pathname.match(/\/business\/([^/?#]+)/);
      if (pathMatch && pathMatch[1]) {
        setCurrentSlug(pathMatch[1]);
      } else if (bizList.length > 0) {
        setCurrentSlug(bizList[0].slug);
      }

      // 2. Cek apakah ada token autentikasi yang masih aktif
      const token = localStorage.getItem('umkm_auth_token');
      let loggedUser: User | null = null;
      let loggedBiz: Business | null = null;
      if (token) {
        try {
          const me = await api.getMe();
          loggedUser = me.user;
          loggedBiz = me.business;
          setCurrentUser(me.user);
          setCurrentBusiness(me.business);
        } catch (authErr) {
          localStorage.removeItem('umkm_auth_token');
        }
      }

      // 3. Cek apakah user berniat membuka admin via URL (#admin, ?admin=true, /admin)
      if (
        window.location.hash === '#admin' || 
        window.location.pathname.startsWith('/admin') || 
        window.location.search.includes('admin=true')
      ) {
        if (loggedUser && loggedBiz) {
          setViewMode('admin');
        } else {
          setIsLoginModalOpen(true);
        }
      }
    } catch (err) {
      console.warn('Init app error:', err);
    }
  };

  const handleOpenAdmin = () => {
    if (currentUser && currentBusiness) {
      if (window.location.hash !== '#admin') {
        window.history.pushState({ page: 'admin' }, '', '#admin');
      }
      setViewMode('admin');
    } else {
      if (window.location.hash !== '#login') {
        window.history.pushState({ modal: 'login' }, '', '#login');
      }
      setIsLoginModalOpen(true);
    }
  };

  const handleCloseLoginModal = () => {
    setIsLoginModalOpen(false);
    if (window.location.hash === '#login') {
      window.history.back();
    }
  };

  const handleLoginSuccess = (user: User, business: Business) => {
    setCurrentUser(user);
    setCurrentBusiness(business);
    setIsLoginModalOpen(false);
    if (window.location.hash !== '#admin') {
      window.history.pushState({ page: 'admin' }, '', '#admin');
    }
    setViewMode('admin');
  };

  const handleBackToPublic = () => {
    setViewMode('public');
    if (window.location.hash === '#admin' || window.location.hash === '#login') {
      window.history.pushState({ page: 'public' }, '', window.location.pathname + window.location.search);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCurrentBusiness(null);
    handleBackToPublic();
  };

  if (viewMode === 'admin' && currentUser && currentBusiness) {
    return (
      <AdminDashboard
        currentUser={currentUser}
        currentBusiness={currentBusiness}
        onLogout={handleLogout}
        onViewPublicCatalog={handleBackToPublic}
      />
    );
  }

  return (
    <>
      <PublicCatalogPage
        currentSlug={currentSlug}
        onOpenAdminLogin={handleOpenAdmin}
      />

      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={handleCloseLoginModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
