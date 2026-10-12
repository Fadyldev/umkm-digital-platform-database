import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  ShoppingBag, 
  Loader2, 
  CreditCard, 
  Utensils, 
  Bike,
  QrCode,
  Banknote,
  Download,
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react';
import QRCode from 'qrcode';
import { CartItem, Business, Order, Setting, PaymentConfig } from '../types';
import { api } from '../services/api';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  business: Business;
  settings: Setting | null;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateNote: (productId: string, note: string) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: Order) => void;
  defaultTableNumber?: string;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  business,
  settings,
  onUpdateQuantity,
  onUpdateNote,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
  defaultTableNumber,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'take_away' | 'delivery'>('dine_in');
  const [tableNumber, setTableNumber] = useState(defaultTableNumber || '');
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'cash'>('qris');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [qrisQrDataUrl, setQrisQrDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string>('');

  const paymentConfig: PaymentConfig = settings?.additional_config?.payment_config || {
    qris_enabled: true,
    qris_merchant_name: business.name || 'Warkop Nusantara',
    qris_nmid: 'ID1020261928374',
    cash_enabled: true,
  };

  const estimatedTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Sinkronisasi history browser agar tombol 'Back' di HP menutup keranjang dan tidak keluar web
  useEffect(() => {
    if (!isOpen) return;

    if (window.location.hash !== '#cart') {
      window.history.pushState({ modal: 'cart' }, '', '#cart');
    }

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  const handleSafeClose = () => {
    if (window.location.hash === '#cart') {
      window.history.back();
    } else {
      onClose();
    }
  };

  // Generate QR Code QRIS dinamis berstandar nasional
  useEffect(() => {
    if (paymentMethod === 'qris' && estimatedTotal > 0) {
      const merchant = (paymentConfig.qris_merchant_name || business.name || 'Warkop Nusantara').toUpperCase();
      const nmid = paymentConfig.qris_nmid || 'ID1020261928374';
      const qrisString = `00020101021226600016ID.CO.QRIS.WWW011893600998${business.id ? business.id.slice(0, 8) : '10293847'}0215${nmid}520458125303360540${estimatedTotal}5802ID59${merchant.length < 10 ? '0' + merchant.length : merchant.length}${merchant}6007JAKARTA6304`;

      QRCode.toDataURL(qrisString, {
        width: 320,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrisQrDataUrl(url))
        .catch((err) => console.warn('QR Code generation error:', err));
    }
  }, [paymentMethod, estimatedTotal, business.name, paymentConfig.qris_merchant_name, paymentConfig.qris_nmid, business.id]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2500);
  };

  const handleDownloadQris = () => {
    const url = paymentConfig.qris_image_url || qrisQrDataUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `QRIS_${(business.name || 'Warkop').replace(/\s+/g, '_')}_${estimatedTotal}.png`;
    a.click();
  };

  // Update tableNumber jika defaultTableNumber berubah (misal dari QR Code meja)
  useEffect(() => {
    if (defaultTableNumber) {
      setTableNumber(defaultTableNumber);
      setOrderType('dine_in');
    }
  }, [defaultTableNumber]);

  if (!isOpen) return null;

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('Nama pemesan wajib diisi.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Nomor WhatsApp wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);

      const formattedTable = orderType === 'dine_in' && tableNumber.trim()
        ? (tableNumber.toLowerCase().startsWith('meja') ? tableNumber.trim() : `Meja ${tableNumber.trim()}`)
        : undefined;

      const orderPayload = {
        business_id: business.id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_note: customerNote.trim(),
        order_type: orderType,
        table_number: formattedTable,
        payment_method: paymentMethod,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          item_note: item.note,
        })),
      };

      const createdOrder = await api.createOrder(orderPayload);
      onClearCart();
      onClose();
      onOrderSuccess(createdOrder);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengirim pesanan. Silakan periksa kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryColor = settings?.primary_color || '#78350f';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer" 
        onClick={handleSafeClose} 
      />

      {/* BOTTOM SHEET CONTAINER (Meluncur dari Bawah) */}
      <div 
        className="relative z-10 w-full max-w-2xl mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-slide-up border-t border-neutral-200 overflow-hidden"
      >
        {/* Drag Handle Top Bar */}
        <div className="pt-2.5 pb-1 flex justify-center bg-white">
          <div className="w-12 h-1.5 bg-neutral-300 rounded-full" />
        </div>

        {/* Header Bottom Sheet */}
        <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-neutral-700" />
            <h2 className="text-base font-bold text-neutral-800">Keranjang Pesanan</h2>
            <span className="text-xs bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-semibold">
              {cart.length} menu
            </span>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 stroke-[1.5] text-neutral-300" />
              <p className="font-medium text-neutral-600">Keranjang masih kosong</p>
              <p className="text-xs mt-1">Pilih menu favorit Anda di katalog untuk memesan.</p>
            </div>
          ) : (
            <>
              {/* Daftar Menu di Keranjang */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex flex-col gap-2"
                  >
                    <div className="flex gap-3">
                      {item.product.image_url && (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-14 h-14 object-cover rounded-lg shrink-0 border border-neutral-200"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-neutral-800 truncate">{item.product.name}</h4>
                        <p className="text-xs text-neutral-500 font-medium">
                          {formatRupiah(item.product.price)} x {item.quantity} ={' '}
                          <span className="font-bold text-neutral-800">
                            {formatRupiah(item.product.price * item.quantity)}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="text-neutral-400 hover:text-rose-500 transition p-1 self-start cursor-pointer"
                        title="Hapus menu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Catatan Item */}
                    <input
                      type="text"
                      placeholder="Catatan menu (misal: pedas sedang, es sedikit)..."
                      value={item.note}
                      onChange={(e) => onUpdateNote(item.product.id, e.target.value)}
                      className="text-xs w-full px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-600 text-neutral-700"
                    />

                    {/* Kontrol Jumlah */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-200/60">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-md bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 text-neutral-600 transition cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-neutral-800">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-md bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 text-neutral-600 transition cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form Data Pemesan */}
              <form id="orderForm" onSubmit={handleSubmitOrder} className="space-y-4 pt-3 border-t border-neutral-200">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Informasi Pemesanan</h3>

                {errorMessage && (
                  <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                    {errorMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Nama Pemesan *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dimas Aditya"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Nomor WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Contoh: 081234567890"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800"
                  />
                </div>

                {/* Tipe Pesanan */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Tipe Pesanan</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderType('dine_in')}
                      className={`py-2 px-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer ${
                        orderType === 'dine_in'
                          ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      Dine In
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('take_away')}
                      className={`py-2 px-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer ${
                        orderType === 'take_away'
                          ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Take Away
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('delivery')}
                      className={`py-2 px-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer ${
                        orderType === 'delivery'
                          ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      <Bike className="w-3.5 h-3.5" />
                      Delivery
                    </button>
                  </div>
                </div>

                {orderType === 'dine_in' && (
                  <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-amber-950">
                        Nomor Meja Dine-In *
                      </label>
                      {tableNumber && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                          Aktif: {tableNumber}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Ketik nomor meja, contoh: 5 atau Meja 05"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800 font-semibold"
                    />
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-neutral-500 block">Pilih Cepat Meja:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                          const label = `Meja ${num < 10 ? `0${num}` : num}`;
                          const isSelected = tableNumber === label || tableNumber === String(num);
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setTableNumber(label)}
                              className={`text-[11px] px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-800 text-white shadow-xs'
                                  : 'bg-white border border-neutral-200 hover:border-amber-400 text-neutral-700'
                              }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* METODE PEMBAYARAN: HANYA QRIS DAN TUNAI */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-neutral-700">Metode Pembayaran</label>
                    <span className="text-[10px] text-neutral-400 font-medium">Pilih cara bayar</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Tombol QRIS */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('qris')}
                      className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer relative ${
                        paymentMethod === 'qris'
                          ? 'border-red-600 bg-red-50/70 shadow-xs ring-1 ring-red-600'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <span className="absolute top-2 right-2 text-[9px] bg-red-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                        Rekomendasi
                      </span>
                      <div className="flex items-center gap-1.5">
                        <QrCode className={`w-4 h-4 ${paymentMethod === 'qris' ? 'text-red-700' : 'text-neutral-500'}`} />
                        <span className={`text-xs font-bold ${paymentMethod === 'qris' ? 'text-red-950' : 'text-neutral-800'}`}>
                          QRIS
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 leading-tight">
                        Scan Semua Bank & E-Wallet
                      </span>
                    </button>

                    {/* Tombol Tunai */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-amber-700 bg-amber-50/70 shadow-xs ring-1 ring-amber-700'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Banknote className={`w-4 h-4 ${paymentMethod === 'cash' ? 'text-amber-800' : 'text-neutral-500'}`} />
                        <span className={`text-xs font-bold ${paymentMethod === 'cash' ? 'text-amber-950' : 'text-neutral-800'}`}>
                          Tunai di Kasir
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 leading-tight">
                        Bayar saat disajikan / ke kasir
                      </span>
                    </button>
                  </div>

                  {/* KARTU PREVIEW QRIS INTERAKTIF */}
                  {paymentMethod === 'qris' && (
                    <div className="p-3.5 bg-gradient-to-b from-red-50/60 via-white to-neutral-50 rounded-2xl border-2 border-red-500/40 shadow-sm space-y-3">
                      {/* Header QRIS Nasional */}
                      <div className="flex items-center justify-between border-b border-red-100 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded tracking-wider">
                            QRIS
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-neutral-900 uppercase tracking-tight">
                              {paymentConfig.qris_merchant_name || business.name}
                            </div>
                            <div className="text-[9px] font-mono text-neutral-400">
                              NMID: {paymentConfig.qris_nmid || 'ID1020261928374'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Siap Scan
                        </span>
                      </div>

                      {/* Barcode QRIS */}
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-neutral-200/80 shadow-inner">
                        {paymentConfig.qris_image_url || qrisQrDataUrl ? (
                          <img
                            src={paymentConfig.qris_image_url || qrisQrDataUrl}
                            alt="QRIS Barcode"
                            className="w-48 h-48 object-contain rounded-lg"
                          />
                        ) : (
                          <div className="w-48 h-48 flex items-center justify-center bg-neutral-100 rounded-lg text-neutral-400">
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </div>
                        )}

                        <div className="mt-2 text-center">
                          <span className="text-[10px] text-neutral-500 block">Total Nominal:</span>
                          <span className="text-sm font-black text-neutral-900 font-mono">
                            {formatRupiah(estimatedTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Petunjuk scan */}
                      <div className="text-[10px] text-neutral-600 space-y-1 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/60">
                        <div className="font-semibold text-neutral-800 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Mendukung semua m-Banking & E-Wallet:
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          BCA Mobile • Livin Mandiri • BRImo • BNI Mobile • GoPay • OVO • DANA • ShopeePay • LinkAja
                        </div>
                      </div>

                      {/* Tombol Unduh & Salin Nominal */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadQris}
                          className="flex-1 py-1.5 px-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg text-[11px] font-semibold text-neutral-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Unduh QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(String(estimatedTotal), 'qris_total')}
                          className="py-1.5 px-3 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg text-[11px] font-semibold text-neutral-700 flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedField === 'qris_total' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Disalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Total</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* KARTU BAYAR TUNAI */}
                  {paymentMethod === 'cash' && (
                    <div className="p-3 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2">
                      <Banknote className="w-4 h-4 text-neutral-700 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-neutral-900 block font-semibold">Bayar Tunai di Kasir</strong>
                        <span className="text-[11px]">
                          Silakan siapkan uang pas sebesar <strong>{formatRupiah(estimatedTotal)}</strong>. Anda dapat membayar saat hidangan disajikan di meja atau langsung ke meja kasir.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Catatan Tambahan</label>
                  <textarea
                    rows={2}
                    placeholder="Instruksi tambahan untuk penjual..."
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800"
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Checkout Sticky */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-neutral-200 bg-white">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-xs text-neutral-500">Total Pembayaran ({cart.length} item)</span>
              <span className="text-base font-bold text-neutral-900">{formatRupiah(estimatedTotal)}</span>
            </div>

            <button
              type="submit"
              form="orderForm"
              disabled={isSubmitting}
              style={{ backgroundColor: primaryColor }}
              className="w-full py-3 px-4 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg transition hover:brightness-110 disabled:opacity-50 cursor-pointer text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses Pesanan...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Kirim Pesanan Sekarang
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
