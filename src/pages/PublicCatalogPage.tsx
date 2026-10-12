import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  MapPin, 
  Phone, 
  Clock, 
  ExternalLink, 
  MessageCircle, 
  Plus, 
  Info, 
  Store,
  ChevronDown,
  Sparkles,
  Settings
} from 'lucide-react';
import { Business, Category, Product, Setting, CartItem, Order } from '../types';
import { api } from '../services/api';
import { ThemeWrapper } from '../components/ThemeWrapper';
import { CartDrawer } from '../components/CartDrawer';
import { OrderSuccessModal } from '../components/OrderSuccessModal';

interface PublicCatalogPageProps {
  currentSlug: string;
  onOpenAdminLogin: () => void;
}

export const PublicCatalogPage: React.FC<PublicCatalogPageProps> = ({
  currentSlug,
  onOpenAdminLogin,
}) => {
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<Setting | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [showBusinessInfo, setShowBusinessInfo] = useState(false);
  const [detectedTable, setDetectedTable] = useState<string>('');

  // Sinkronisasi tombol Back pada modal Info Bisnis agar tidak keluar dari web
  useEffect(() => {
    if (!showBusinessInfo) return;
    window.history.pushState({ modal: 'info' }, '');
    const handlePopState = () => {
      setShowBusinessInfo(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showBusinessInfo]);

  useEffect(() => {
    // Deteksi parameter nomor meja dari link QR Code (?meja=5, ?table=5, atau #meja=5)
    const params = new URLSearchParams(window.location.search);
    let tableParam = params.get('meja') || params.get('table');
    if (!tableParam && window.location.hash) {
      const hashMatch = window.location.hash.match(/(?:meja|table)[=-]?([0-9a-zA-Z]+)/i);
      if (hashMatch) {
        tableParam = hashMatch[1];
      }
    }
    if (tableParam) {
      const formatted = tableParam.toLowerCase().startsWith('meja')
        ? tableParam
        : `Meja ${tableParam.padStart(2, '0')}`;
      setDetectedTable(formatted);
    }
  }, []);

  useEffect(() => {
    loadCatalogData();

    // Auto-sync berkala tiap 15 detik agar ketersediaan & harga menu selalu up-to-date di HP
    const timer = setInterval(() => {
      loadCatalogData(true);
    }, 15000);

    // Auto-sync saat layar HP dinyalakan kembali atau tab dibuka lagi
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadCatalogData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentSlug]);

  const loadCatalogData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setIsLoading(true);
        setError('');
      }
      const data = await api.getPublicBusiness(currentSlug);
      setBusiness(data.business);
      setSettings(data.settings);
      setCategories(data.categories);
      setProducts(data.products);
      if (!isBackground) {
        setSelectedCategoryId('all');
      }
    } catch (err: any) {
      if (!isBackground) {
        setError(err.message || 'Gagal memuat katalog bisnis');
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Cart Handlers
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, note: '' }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleUpdateNote = (productId: string, note: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, note } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const filteredProducts = selectedCategoryId === 'all'
    ? products
    : products.filter((p) => p.category_id === selectedCategoryId);

  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalPrice = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-neutral-600">Memuat katalog bisnis...</p>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl text-center">
          <Store className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-neutral-900">Katalog Tidak Ditemukan</h2>
          <p className="text-sm text-neutral-500 mt-1 mb-5">{error || 'Menu warkop belum terdaftar atau sedang diperbarui.'}</p>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-amber-800 hover:bg-amber-900 text-white transition shadow-sm cursor-pointer"
          >
            Muat Ulang Halaman Menu
          </button>
        </div>
      </div>
    );
  }

  const primaryColor = settings?.primary_color || '#78350f';
  const buttonStyle = settings?.button_style || 'rounded';
  const cardStyle = settings?.card_style || 'shadow';

  const buttonRadiusClass =
    buttonStyle === 'pill'
      ? 'rounded-full'
      : buttonStyle === 'square'
      ? 'rounded-none'
      : 'rounded-xl';

  const cardContainerClass =
    cardStyle === 'bordered'
      ? 'border border-neutral-200 bg-white'
      : cardStyle === 'elevated'
      ? 'shadow-xl bg-white border border-neutral-100'
      : cardStyle === 'flat'
      ? 'bg-neutral-100 border-none'
      : 'shadow-md bg-white border border-neutral-100/80';

  return (
    <ThemeWrapper settings={settings}>
      {/* Top Navigation & Minimalist Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Brand Header */}
          <div className="flex items-center gap-2">
            <span className="text-lg">☕</span>
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-neutral-900 tracking-tight block leading-none">
                {business.name}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">Buku Menu & Pemesanan</span>
            </div>
          </div>

          {/* Action Buttons: Info Toko & Discreet Settings Icon */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            <button
              onClick={() => setShowBusinessInfo(!showBusinessInfo)}
              className="px-2.5 py-1.5 text-neutral-700 hover:text-neutral-900 rounded-xl hover:bg-neutral-100 text-xs font-semibold flex items-center gap-1.5 transition border border-neutral-200/80 cursor-pointer"
              title="Informasi Toko"
            >
              <Info className="w-3.5 h-3.5 text-amber-700" />
              <span>Info Toko</span>
            </button>

            {/* Tombol Kelola Toko untuk Pemilik */}
            <button
              onClick={onOpenAdminLogin}
              className="px-2.5 py-1.5 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition border border-neutral-200/80 cursor-pointer text-xs font-semibold flex items-center gap-1.5"
              title="Kelola Toko (Admin)"
              aria-label="Kelola Toko"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-500" />
              <span>Kelola Toko</span>
            </button>
          </div>
        </div>
      </header>

      {/* Announcement Banner (Settings Dinamis) */}
      {settings?.announcement && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-neutral-800 px-4 py-2 text-xs text-center font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{settings.announcement}</span>
        </div>
      )}

      {/* Banner Notifikasi Meja dari Scan QR */}
      {detectedTable && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs text-center font-bold flex items-center justify-center gap-1.5 shadow-sm">
          <span>📍 Anda sedang memesan langsung dari {detectedTable} (Dine-In)</span>
        </div>
      )}

      {/* Hero Header Bisnis */}
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=300&q=80';
              }}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shadow-md border-2 border-white shrink-0"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-neutral-200 flex items-center justify-center text-neutral-500 shadow-md">
              <Store className="w-10 h-10" />
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">
              {business.name}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1 line-clamp-2 max-w-xl">
              {business.description || 'Selamat datang di katalog online resmi kami.'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-neutral-500">
              {business.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="truncate max-w-[200px]">{business.address}</span>
                </span>
              )}
              {business.whatsapp && (
                <a
                  href={`https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-emerald-600 font-semibold hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {business.whatsapp}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Info Toko Detail & Jam Operasional */}
        {showBusinessInfo && (
          <div className="mt-4 p-5 bg-white rounded-2xl border border-neutral-200 text-xs space-y-3.5 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h3 className="font-bold text-neutral-900 flex items-center gap-1.5 text-sm">
                <Store className="w-4 h-4 text-amber-700" /> Profil Toko & Jam Operasional
              </h3>
              <button
                onClick={() => setShowBusinessInfo(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xs cursor-pointer font-medium"
              >
                Tutup ✕
              </button>
            </div>

            {business.address && (
              <p className="text-neutral-600 leading-relaxed">
                <span className="font-semibold text-neutral-800">📍 Alamat Lengkap:</span> {business.address}
              </p>
            )}

            {business.google_maps_url && (
              <div>
                <a
                  href={business.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Buka Lokasi di Google Maps
                </a>
              </div>
            )}

            {/* Jam Operasional Terstruktur */}
            <div className="pt-2.5 border-t border-neutral-100 space-y-2">
              <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-700" /> Jam Buka Operasional:
              </span>
              {typeof business.opening_hours === 'object' && business.opening_hours !== null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                  {business.opening_hours.senin_jumat && (
                    <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                      <span className="text-[10px] text-amber-900 font-bold block uppercase tracking-wider">
                        Senin - Jumat (Hari Kerja):
                      </span>
                      <span className="font-extrabold text-neutral-900 text-xs mt-0.5 block">
                        {business.opening_hours.senin_jumat}
                      </span>
                    </div>
                  )}
                  {business.opening_hours.sabtu_minggu && (
                    <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                      <span className="text-[10px] text-amber-900 font-bold block uppercase tracking-wider">
                        Sabtu - Minggu (Akhir Pekan):
                      </span>
                      <span className="font-extrabold text-neutral-900 text-xs mt-0.5 block">
                        {business.opening_hours.sabtu_minggu}
                      </span>
                    </div>
                  )}
                  {business.opening_hours.catatan && (
                    <div className="sm:col-span-2 text-[11px] text-emerald-800 font-semibold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <span>✓ {business.opening_hours.catatan}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                  <span className="font-semibold text-neutral-800 text-xs">
                    {business.opening_hours || 'Buka setiap hari: 08:00 - 23:00 WIB'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kategori Tabs Navigation */}
      <div className="sticky top-[53px] z-20 bg-white/95 backdrop-blur-sm border-b border-neutral-200/70 py-2.5">
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            } ${buttonRadiusClass}`}
          >
            Semua Menu ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                } ${buttonRadiusClass}`}
                style={selectedCategoryId === cat.id ? { backgroundColor: primaryColor } : {}}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Katalog Produk */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-28">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200 p-8">
            <Store className="w-12 h-12 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm font-semibold text-neutral-700">Belum ada menu di kategori ini</p>
            <p className="text-xs text-neutral-400 mt-1">Pilih kategori lain untuk melihat daftar menu yang tersedia.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className={`rounded-2xl overflow-hidden flex flex-col transition hover:shadow-lg ${cardContainerClass}`}
              >
                {/* Gambar Produk */}
                <div className="relative aspect-4/3 bg-neutral-100 overflow-hidden">
                  {prod.image_url ? (
                    <img
                      src={prod.image_url}
                      alt={prod.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80';
                      }}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                      <Store className="w-10 h-10 stroke-[1.5]" />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    {prod.is_available ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-600/90 text-white rounded-full backdrop-blur-xs shadow-xs">
                        Tersedia
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-600/90 text-white rounded-full backdrop-blur-xs shadow-xs">
                        Habis
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Produk */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 leading-snug line-clamp-1">
                      {prod.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
                      {prod.description || 'Menu lezat racikan spesial.'}
                    </p>
                  </div>

                  <div className="pt-3 mt-3 border-t border-neutral-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-400 block font-medium">Harga</span>
                      <span className="text-sm font-extrabold text-neutral-900">
                        {formatRupiah(prod.price)}
                      </span>
                    </div>

                    {settings?.is_ordering_enabled !== false ? (
                      <button
                        onClick={() => handleAddToCart(prod)}
                        disabled={!prod.is_available}
                        style={{ backgroundColor: prod.is_available ? primaryColor : undefined }}
                        className={`py-1.5 px-3 text-xs font-semibold text-white flex items-center gap-1 shadow-sm transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                          !prod.is_available ? 'bg-neutral-400' : ''
                        } ${buttonRadiusClass}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Pesan
                      </button>
                    ) : (
                      <span className="text-[10px] text-neutral-400 italic">Hanya Katalog</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer Bersih & Akses Pengelola Toko */}
      <footer className="max-w-4xl mx-auto px-4 pt-10 pb-28 border-t border-neutral-200/70 text-center text-xs text-neutral-400">
        <p className="font-bold text-neutral-700 text-sm">{business.name}</p>
        <p className="text-[11px] text-neutral-500 mt-1">{business.address}</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              setShowBusinessInfo(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-[11px] text-neutral-600 hover:text-neutral-900 font-semibold underline cursor-pointer"
          >
            Info Toko & Jam Buka
          </button>
          <span>•</span>
          <button
            onClick={onOpenAdminLogin}
            className="text-[11px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1 transition cursor-pointer group"
            title="Kelola Toko"
          >
            <Settings className="w-3 h-3 group-hover:rotate-45 transition-transform" />
            <span>Kelola Toko</span>
          </button>
        </div>
        <p className="text-[10px] text-neutral-300 mt-3">
          Sistem Pemesanan Online & Stand QR Meja Warkop Nusantara
        </p>
      </footer>

      {/* Floating Bottom Cart Bar (Mobile Friendly) */}
      {cart.length > 0 && settings?.is_ordering_enabled !== false && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className={`w-full py-3.5 px-5 text-white shadow-2xl flex items-center justify-between transition hover:brightness-110 cursor-pointer ${buttonRadiusClass}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                  {cartTotalCount}
                </div>
                <div className="text-left">
                  <div className="text-xs opacity-90 font-medium">Lihat Keranjang</div>
                  <div className="text-sm font-extrabold">{formatRupiah(cartTotalPrice)}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-white/20 py-1.5 px-3 rounded-lg">
                <ShoppingBag className="w-3.5 h-3.5" />
                Lanjut Pesan
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        business={business}
        settings={settings}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateNote={handleUpdateNote}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOrderSuccess={(order) => setCompletedOrder(order)}
        defaultTableNumber={detectedTable}
      />

      {/* Order Confirmed Receipt Modal */}
      <OrderSuccessModal
        order={completedOrder}
        business={business}
        settings={settings}
        onClose={() => setCompletedOrder(null)}
      />
    </ThemeWrapper>
  );
};
