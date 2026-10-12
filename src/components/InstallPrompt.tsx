import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, X, Share, PlusSquare, Check, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Cek apakah aplikasi sudah terpasang (Standalone mode)
    const isInStandaloneMode = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    if (isInStandaloneMode()) {
      setIsStandalone(true);
      return;
    }

    // 2. Deteksi perangkat iOS (iPhone / iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Listener event beforeinstallprompt (Android / Desktop Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Cek apakah user pernah menutup banner dalam sesi ini
      const isDismissed = sessionStorage.getItem('admin_pwa_prompt_dismissed');
      if (!isDismissed) {
        setIsVisible(true);
      }
    };

    // 4. Listener appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Untuk iOS, jika belum standalone dan belum pernah di-dismiss
    if (isIosDevice && !sessionStorage.getItem('admin_pwa_prompt_dismissed')) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('admin_pwa_prompt_dismissed', 'true');
  };

  // Jangan render jika sudah terpasang sebagai aplikasi standalone
  if (isStandalone || isInstalled) {
    return null;
  }

  return (
    <>
      {/* Banner Mengambang di Bawah Layar Khusus Admin */}
      {isVisible && (
        <aside
          aria-label="Pasang Aplikasi Kasir & POS"
          className="fixed bottom-5 right-5 left-5 md:left-auto md:max-w-md z-50 bg-neutral-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-amber-600/40 animate-in fade-in slide-in-from-bottom duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-900 p-2 flex items-center justify-center shrink-0 shadow-md">
              <img
                src="/pwa-192x192.png"
                alt="Warkop Icon"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <div className="flex-1 min-w-0 pr-2">
              <h2 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                <span>Pasang Aplikasi Kasir / Admin</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-normal">
                  Mode POS
                </span>
              </h2>
              <p className="text-xs text-neutral-300 mt-1 line-clamp-2">
                Pasang di layar utama HP atau Laptop kasir untuk mengelola pesanan, stok, dan cetak struk tanpa perlu buka browser lagi!
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="text-neutral-400 hover:text-white p-1 rounded-lg transition"
              title="Tutup banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3.5 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>{isIOS ? 'Cara Pasang di iPhone' : 'Pasang ke Beranda'}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-xl transition"
            >
              Nanti Saja
            </button>
          </div>
        </aside>
      )}

      {/* Modal Panduan Khusus iOS (Safari) */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-neutral-900 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Pasang di iPhone / iPad</h3>
                  <p className="text-xs text-neutral-500">2 Langkah Praktis</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs text-neutral-700">
              <div className="flex items-start gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </span>
                <p className="leading-relaxed">
                  Ketuk tombol <strong className="inline-flex items-center gap-1 text-neutral-900 bg-neutral-200 px-1.5 py-0.5 rounded"><Share className="w-3.5 h-3.5 text-blue-600" /> Bagikan (Share)</strong> di bilah bawah browser Safari kamu.
                </p>
              </div>

              <div className="flex items-start gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </span>
                <p className="leading-relaxed">
                  Gulir ke bawah dan pilih <strong className="inline-flex items-center gap-1 text-neutral-900 bg-neutral-200 px-1.5 py-0.5 rounded"><PlusSquare className="w-3.5 h-3.5 text-neutral-800" /> Tambah ke Layar Utama</strong> (Add to Home Screen).
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Tombol Badge di Header Admin
export const InstallButtonBadge: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isInStandaloneMode = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    if (isInStandaloneMode()) {
      setIsStandalone(true);
      return;
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (isStandalone) return null;

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        setDeferredPrompt(null);
      } catch (e) {
        console.warn(e);
      }
    }
  };

  return (
    <>
      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 rounded-xl transition border border-amber-300/80 shadow-xs cursor-pointer"
        title="Pasang aplikasi Kasir & Admin ke layar utama HP / Laptop"
      >
        <Download className="w-3.5 h-3.5 text-amber-700" />
        <span className="hidden sm:inline">Install Aplikasi Kasir</span>
        <span className="sm:hidden">Install App</span>
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-neutral-900 shadow-2xl">
            <h3 className="text-sm font-bold text-neutral-900 mb-2">Pasang di iPhone / iPad</h3>
            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              Ketuk ikon <strong>Bagikan (Share)</strong> di bagian bawah Safari, lalu pilih <strong>Tambah ke Layar Utama</strong>.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-amber-800 text-white text-xs font-semibold rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
