import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  MapPin, 
  Clock, 
  ExternalLink, 
  MessageCircle, 
  Plus, 
  Info, 
  Store,
  Sparkles,
  Settings,
  Coffee,
  CheckCircle2,
  X,
  QrCode,
  Download,
  Banknote
} from 'lucide-react';
import QRCode from 'qrcode';
import { Business, Category, Product, Setting, CartItem, Order, PaymentConfig } from '../types';
import { api } from '../services/api';
import { CartDrawer } from '../components/CartDrawer';

// -------------------------------------------------------------
// THEME WRAPPER (STANDALONE: KAVARNA COFFEE BAR & KITCHEN DARK)
// -------------------------------------------------------------
const ThemeWrapper: React.FC<{ settings: Setting | null; children: React.ReactNode }> = ({ settings, children }) => {
  const isLegacyLight = !settings?.background_color || settings.background_color === '#fffbeb' || settings.background_color === '#ffffff' || settings.background_color === '#fefdfa';
  const primaryColor = settings?.primary_color || '#d97706';
  const secondaryColor = settings?.secondary_color || '#b45309';
  const backgroundColor = isLegacyLight ? '#0d0d0f' : settings.background_color;
  const textColor = isLegacyLight ? '#f4f4f5' : (settings?.text_color || '#f4f4f5');
  const fontFamily = settings?.font_family || 'Plus Jakarta Sans, Inter, sans-serif';

  const themeStyles = {
    '--color-primary': primaryColor,
    '--color-secondary': secondaryColor,
    '--color-bg': backgroundColor,
    '--color-text': textColor,
    fontFamily: fontFamily,
    backgroundColor: backgroundColor,
    color: textColor,
  } as React.CSSProperties;

  return (
    <div style={themeStyles} className="min-h-screen transition-colors duration-300">
      {children}
    </div>
  );
};

// -------------------------------------------------------------
// ORDER SUCCESS MODAL (DILENGKAPI QRIS & WHATSAPP)
// -------------------------------------------------------------
interface OrderSuccessModalProps {
  order: Order | null;
  business: Business;
  settings?: Setting | null;
  onClose: () => void;
}

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ order, business, settings, onClose }) => {
  const [qrisQrDataUrl, setQrisQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!order) return;

    if (window.location.hash !== '#order-success') {
      window.history.pushState({ modal: 'order_success' }, '', '#order-success');
    }

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [order, onClose]);

  const handleSafeClose = () => {
    if (window.location.hash === '#order-success') {
      window.history.back();
    } else {
      onClose();
    }
  };

  const paymentConfig: PaymentConfig = settings?.additional_config?.payment_config || {
    qris_enabled: true,
    qris_merchant_name: business.name || 'Kavarna Coffee Bar & Kitchen',
    qris_nmid: 'ID1020261928374',
    cash_enabled: true,
  };

  useEffect(() => {
    if (order && order.payment_method === 'qris' && order.total_amount > 0) {
      const merchant = (paymentConfig.qris_merchant_name || business.name || 'Kavarna Coffee Bar & Kitchen').toUpperCase();
      const nmid = paymentConfig.qris_nmid || 'ID1020261928374';
      const qrisString = `00020101021226600016ID.CO.QRIS.WWW011893600998${business.id ? business.id.slice(0, 8) : '10293847'}0215${nmid}520458125303360540${order.total_amount}5802ID59${merchant.length < 10 ? '0' + merchant.length : merchant.length}${merchant}6007JAKARTA6304`;

      QRCode.toDataURL(qrisString, {
        width: 280,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then((url) => setQrisQrDataUrl(url))
        .catch(() => {});
    }
  }, [order, business.name, business.id, paymentConfig.qris_merchant_name, paymentConfig.qris_nmid]);

  if (!order) return null;

  const handleDownloadQris = () => {
    const url = paymentConfig.qris_image_url || qrisQrDataUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `QRIS_${order.order_number}.png`;
    a.click();
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSendToWhatsApp = () => {
    const phone = business.whatsapp || business.phone;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

    const itemsSummary = (order.items || [])
      .map((it) => `- ${it.quantity}x ${it.product_name} (${formatRupiah(it.price)}) ${it.item_note ? `[Catatan: ${it.item_note}]` : ''}`)
      .join('\n');

    const paymentLabel = order.payment_method === 'qris' ? 'QRIS (Pembayaran Digital)' : 'TUNAI DI KASIR';

    const message = `Halo ${business.name}, saya telah membuat pesanan baru!\n\n` +
      `*No. Pesanan:* ${order.order_number}\n` +
      `*Nama Pemesan:* ${order.customer_name}\n` +
      `*Tipe:* ${order.order_type.toUpperCase()} ${order.table_number ? `(${order.table_number})` : ''}\n` +
      `*Metode Pembayaran:* ${paymentLabel}\n\n` +
      `*Daftar Pesanan:*\n${itemsSummary}\n\n` +
      `*Total Tagihan:* ${formatRupiah(order.total_amount)}\n\n` +
      `Mohon diproses, terima kasih!`;

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-neutral-100 my-8">
        <button
          onClick={handleSafeClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition cursor-pointer p-1"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-2.5">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Pesanan Berhasil Dibuat!</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Pesanan Anda telah dicatat oleh sistem kasir {business.name}.
          </p>
        </div>

        {/* Ringkasan Pesanan */}
        <div className="bg-neutral-950/80 rounded-xl p-3.5 mb-4 border border-neutral-800 text-xs space-y-1.5">
          <div className="flex justify-between items-center pb-1.5 border-b border-neutral-800">
            <span className="text-neutral-400 font-medium">Nomor Pesanan</span>
            <span className="font-mono font-bold text-amber-400 text-sm">{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Nama Pelanggan</span>
            <span className="font-medium text-white">{order.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Tipe Pesanan</span>
            <span className="font-medium capitalize text-white">
              {order.order_type === 'dine_in' ? `Dine In (${order.table_number || 'Meja Umum'})` : order.order_type}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Metode Bayar</span>
            <span className={`font-bold uppercase px-2 py-0.5 rounded text-[11px] ${
              order.payment_method === 'qris'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {order.payment_method === 'qris' ? 'QRIS Digital' : 'Tunai di Kasir'}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-neutral-800">
            <span className="font-bold text-neutral-300">Total Tagihan</span>
            <span className="font-bold text-emerald-400 text-base">{formatRupiah(order.total_amount)}</span>
          </div>
        </div>

        {/* TAMPILAN PEMBAYARAN SESUAI METODE */}
        {order.payment_method === 'qris' ? (
          <div className="mb-4 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-rose-400">
              <QrCode className="w-4 h-4 text-rose-400" />
              <span>Silakan Scan QRIS untuk Menyelesaikan Pembayaran</span>
            </div>
            {paymentConfig.qris_image_url || qrisQrDataUrl ? (
              <div className="inline-block p-2 bg-white rounded-xl shadow-xs border border-neutral-300">
                <img 
                  src={paymentConfig.qris_image_url || qrisQrDataUrl} 
                  alt="QRIS" 
                  className="w-40 h-40 object-contain mx-auto" 
                />
              </div>
            ) : null}
            <div className="text-[11px] text-neutral-400">
              Mendukung GoPay, OVO, DANA, BCA, Livin, BRImo, ShopeePay
            </div>
            <button
              type="button"
              onClick={handleDownloadQris}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Gambar QRIS
            </button>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-300 flex items-start gap-2">
            <Banknote className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <strong className="text-white block font-semibold">Pembayaran Tunai di Kasir</strong>
              <span className="text-[11px] text-neutral-400">
                Silakan siapkan uang pas sebesar <strong className="text-white">{formatRupiah(order.total_amount)}</strong> saat hidangan disajikan di meja atau langsung ke meja kasir.
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleSendToWhatsApp}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer text-xs"
          >
            <MessageCircle className="w-4 h-4" />
            Konfirmasi Pesanan via WhatsApp
          </button>
          <button
            onClick={handleSafeClose}
            className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl font-medium transition cursor-pointer text-xs"
          >
            Tutup & Kembali ke Menu
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// MAIN CATALOG PAGE
// -------------------------------------------------------------
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
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let tableVal = urlParams.get('meja') || urlParams.get('table') || urlParams.get('m');
      
      if (!tableVal && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
        tableVal = hashParams.get('meja') || hashParams.get('table') || hashParams.get('m');
      }

      if (tableVal) {
        setDetectedTable(tableVal.toUpperCase().startsWith('MEJA') ? tableVal : `Meja ${tableVal}`);
      }
    } catch {
      // Fallback silent
    }
  }, []);

  const loadCatalogData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await api.getPublicBusiness(currentSlug);
      setBusiness(data.business);
      setSettings(data.settings);
      setCategories(data.categories || []);
      setProducts(data.products || []);

      if (data.business?.name) {
        document.title = `${data.business.name} - Menu Digital & QR Order Meja`;
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat katalog menu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, [currentSlug]);

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

  const cartTotalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalPrice = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const formatRupiah = (amount: number) => {
    const symbol = (settings as any)?.currency_symbol || 'Rp';
    return `${symbol} ${Number(amount || 0).toLocaleString('id-ID')}`;
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategoryId === 'all') return true;
    return p.category_id === selectedCategoryId;
  });

  const primaryColor = settings?.primary_color || '#d97706';
  const buttonRadiusClass =
    settings?.button_style === 'pill'
      ? 'rounded-full'
      : settings?.button_style === 'square'
      ? 'rounded-none'
      : 'rounded-xl';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] text-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-neutral-400 font-medium text-sm">Menyiapkan daftar menu Kavarna Coffee...</p>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center text-amber-500 mb-4 shadow-lg">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Menu Belum Tersedia</h1>
        <p className="text-neutral-400 text-sm max-w-sm mb-6 leading-relaxed">
          {error || 'Katalog kafe saat ini sedang dalam pemeliharaan atau belum dikonfigurasi.'}
        </p>
        <button
          onClick={loadCatalogData}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl transition text-sm shadow-lg shadow-amber-600/20"
        >
          Muat Ulang
        </button>
      </div>
    );
  }

  return (
    <ThemeWrapper settings={settings}>
      {/* Top Banner & Header */}
      <header className="relative bg-neutral-900 border-b border-neutral-800/80 overflow-hidden">
        {(business as any).banner_url ? (
          <div className="h-44 sm:h-56 w-full relative overflow-hidden">
            <img
              src={(business as any).banner_url}
              alt={business.name}
              className="w-full h-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
          </div>
        ) : (
          <div className="h-28 sm:h-36 w-full bg-gradient-to-r from-amber-950/40 via-neutral-900 to-amber-950/20 border-b border-neutral-800" />
        )}

        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative pb-5 -mt-12 sm:-mt-16">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
            {/* Logo */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-neutral-900 border-2 border-neutral-800 shadow-2xl shrink-0 p-1">
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="w-full h-full bg-amber-600 flex items-center justify-center text-neutral-950 font-black text-2xl rounded-xl">
                  {business.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Business Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {business.name}
                </h1>
                {detectedTable && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    {detectedTable}
                  </span>
                )}
              </div>

              {business.description && (
                <p className="text-xs sm:text-sm text-neutral-400 line-clamp-2 max-w-xl">
                  {business.description}
                </p>
              )}

              {/* Action bar info */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-neutral-300">
                <button
                  onClick={() => setShowBusinessInfo(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-200 transition font-medium cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>Info Kafe & Jam Buka</span>
                </button>

                {business.whatsapp && (
                  <a
                    href={`https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-300 transition font-medium"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Announcement bar */}
      {settings?.announcement && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs font-medium text-amber-300 flex items-center justify-center gap-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>{settings.announcement}</span>
        </div>
      )}

      {/* Sticky Categories Bar */}
      <nav className="sticky top-0 z-30 bg-[#0d0d0f]/95 backdrop-blur-md border-b border-neutral-800/80 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategoryId === 'all'
                ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
            }`}
          >
            Semua Menu ({products.length})
          </button>

          {categories.map((cat) => {
            const count = products.filter((p) => p.category_id === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                <span>{cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content: Product Catalog */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-neutral-900/60 rounded-2xl border border-neutral-800/80 p-8 my-6">
            <Coffee className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Belum Ada Menu di Kategori Ini</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-4">
              Silakan pilih kategori menu lainnya di atas untuk melihat pilihan hidangan & minuman.
            </p>
            <button
              onClick={() => setSelectedCategoryId('all')}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Tampilkan Semua Menu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredProducts.map((product) => {
              const inCartItem = cart.find((it) => it.product.id === product.id);
              const isAvailable = product.is_available !== false && (product.stock > 0 || product.stock === -1 || product.stock === undefined);

              return (
                <div
                  key={product.id}
                  className={`group relative rounded-2xl border border-neutral-800/90 bg-neutral-900/80 overflow-hidden flex flex-col justify-between transition duration-200 hover:border-amber-500/40 hover:bg-neutral-900 shadow-md ${
                    !isAvailable ? 'opacity-60 grayscale' : ''
                  }`}
                >
                  {/* Image */}
                  <div className="h-40 sm:h-44 w-full relative overflow-hidden bg-neutral-950">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 bg-neutral-950">
                        <Coffee className="w-8 h-8 mb-1 text-neutral-700" />
                        <span className="text-[10px] text-neutral-500 font-medium">Kavarna Menu</span>
                      </div>
                    )}

                    {!isAvailable && (
                      <div className="absolute inset-0 bg-neutral-950/80 flex items-center justify-center">
                        <span className="px-3 py-1 bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold rounded-lg uppercase tracking-wider">
                          Habis
                        </span>
                      </div>
                    )}

                    {inCartItem && (
                      <div className="absolute top-2.5 right-2.5 bg-amber-500 text-neutral-950 text-xs font-black px-2 py-0.5 rounded-full shadow-lg">
                        {inCartItem.quantity} di keranjang
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-amber-400 transition leading-snug">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                      <div className="font-mono font-bold text-sm sm:text-base text-amber-400">
                        {formatRupiah(product.price)}
                      </div>

                      {isAvailable && (
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={settings?.is_ordering_enabled === false}
                          style={{ backgroundColor: primaryColor }}
                          className={`px-3 py-1.5 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonRadiusClass}`}
                          title="Tambah ke Pesanan"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Pesan</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Info Modal Kafe & Jam Operasional */}
      {showBusinessInfo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBusinessInfo(false);
          }}
        >
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-neutral-100">
            <button
              onClick={() => setShowBusinessInfo(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white transition cursor-pointer p-1"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{business.name}</h3>
                <span className="text-xs text-neutral-400">Coffee Bar & Kitchen</span>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-neutral-300">
              {business.address && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block mb-0.5">Alamat Lokasi</span>
                    <p className="text-neutral-400 leading-relaxed">{business.address}</p>
                    {business.google_maps_url && (
                      <a
                        href={business.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-amber-400 hover:underline mt-1.5 font-semibold"
                      >
                        Buka di Google Maps
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {business.opening_hours && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold text-white block mb-1">Jam Operasional</span>
                    <div className="space-y-1 text-neutral-400">
                      {typeof business.opening_hours === 'object' ? (
                        Object.entries(business.opening_hours).map(([day, hours]: any) => (
                          <div key={day} className="flex justify-between">
                            <span className="capitalize">{day}</span>
                            <span className="font-medium text-neutral-200">
                              {hours?.open ? `${hours.open} - ${hours.close}` : (typeof hours === 'string' ? hours : 'Tutup')}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p>{String(business.opening_hours)}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowBusinessInfo(false)}
              className="mt-5 w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Kembali ke Menu
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center border-t border-neutral-900 mt-12 mb-16">
        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
          <button
            onClick={() => setShowBusinessInfo(true)}
            className="hover:text-amber-400 transition cursor-pointer"
          >
            Info Kafe & Jam Operasional
          </button>
          <span>•</span>
          <button
            onClick={onOpenAdminLogin}
            className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 transition cursor-pointer group"
            title="Kelola Toko"
          >
            <Settings className="w-3 h-3 group-hover:rotate-45 transition-transform text-amber-500" />
            <span>Kelola Toko (Admin)</span>
          </button>
        </div>
        <p className="text-[10px] text-neutral-600 mt-3">
          Sistem Pemesanan Meja Kavarna Coffee Bar & Kitchen • Sukoharjo
        </p>
      </footer>

      {/* Floating Bottom Cart Bar (Mobile Friendly) */}
      {cart.length > 0 && settings?.is_ordering_enabled !== false && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className={`w-full py-3.5 px-5 text-neutral-950 font-bold shadow-2xl flex items-center justify-between transition hover:brightness-110 cursor-pointer ${buttonRadiusClass}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-950/20 flex items-center justify-center font-black text-xs text-neutral-950">
                  {cartTotalCount}
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-semibold opacity-90">Lihat Pesanan</div>
                  <div className="text-sm font-black font-mono">{formatRupiah(cartTotalPrice)}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider bg-neutral-950/15 py-1.5 px-3 rounded-xl">
                <ShoppingBag className="w-3.5 h-3.5" />
                Lanjut ke Meja
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

      {/* Order Confirmed Success Modal */}
      <OrderSuccessModal
        order={completedOrder}
        business={business}
        settings={settings}
        onClose={() => setCompletedOrder(null)}
      />
    </ThemeWrapper>
  );
};