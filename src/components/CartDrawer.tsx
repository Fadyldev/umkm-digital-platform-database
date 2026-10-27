import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
  ReceiptText
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

const SEATING_AREAS = [
  { id: 'lt1_indoor', label: 'Lt. 1 Indoor (AC & Bar)' },
  { id: 'lt2_indoor', label: 'Lt. 2 Indoor (AC & Coworking)' },
  { id: 'lt2_outdoor', label: 'Lt. 2 Outdoor (Balkon & Smoking)' },
  { id: 'vip_meeting', label: 'VIP Meeting Room' },
];

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
  
  // Area & Meja (1-50 gulir bebas)
  const [seatingArea, setSeatingArea] = useState<string>('lt2_indoor');
  const [tableNumber, setTableNumber] = useState<string>(defaultTableNumber || 'Meja 01');
  const [customTable, setCustomTable] = useState<string>('');
  
  // Metode Pembayaran Kavarna
  const [paymentChoice, setPaymentChoice] = useState<'edc_table' | 'cash_table' | 'cash_cashier' | 'qris_online'>('edc_table');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [qrisQrDataUrl, setQrisQrDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string>('');
  
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const scrollTables = (direction: 'left' | 'right') => {
    if (tableScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      tableScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const paymentConfig: PaymentConfig = settings?.additional_config?.payment_config || {
    qris_enabled: true,
    qris_merchant_name: business.name || 'Kavarna Coffee Bar & Kitchen',
    qris_nmid: 'ID1020261928374',
    cash_enabled: true,
  };

  // Perhitungan Subtotal Pesanan
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Pajak Restoran (PB1) - Dinamis dari Settings (Default: 0% Nett, bisa diaktifkan 10% PB1 di Admin)
  const isTaxEnabled = Boolean(settings?.additional_config?.tax_enabled);
  const taxPercentage = Number(settings?.additional_config?.tax_percentage ?? 10);
  const taxAmount = isTaxEnabled ? Math.round((subtotal * taxPercentage) / 100) : 0;
  
  // TOTAL AKHIR: Nilai bulat bersih tanpa kode unik acak (0 rupiah receh)
  const grandTotal = subtotal + taxAmount;

  // Sinkronisasi history browser agar tombol 'Back' di HP menutup keranjang
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

  // Generate QR Code QRIS toko jika opsi scan dipilih (menggunakan grandTotal pas)
  useEffect(() => {
    if (paymentChoice === 'qris_online' && grandTotal > 0) {
      const merchant = (paymentConfig.qris_merchant_name || business.name || 'Kavarna Coffee Bar & Kitchen').toUpperCase();
      const nmid = paymentConfig.qris_nmid || 'ID1020261928374';
      const qrisString = `00020101021226600016ID.CO.QRIS.WWW011893600998${business.id ? business.id.slice(0, 8) : '10293847'}0215${nmid}520458125303360540${grandTotal}5802ID59${merchant.length < 10 ? '0' + merchant.length : merchant.length}${merchant}6007JAKARTA6304`;

      QRCode.toDataURL(qrisString, {
        width: 320,
        margin: 1,
        color: {
          dark: '#1e1e24',
          light: '#ffffff',
        },
      })
        .then((url) => setQrisQrDataUrl(url))
        .catch((err) => console.warn('QR Code generation error:', err));
    }
  }, [paymentChoice, grandTotal, business.name, paymentConfig.qris_merchant_name, paymentConfig.qris_nmid, business.id]);

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
    a.download = `QRIS_Kavarna_${grandTotal}.png`;
    a.click();
  };

  // Update jika ada default meja dari URL QR scan
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

  const selectedAreaObj = SEATING_AREAS.find((a) => a.id === seatingArea) || SEATING_AREAS[1];

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

      const activeTable = customTable.trim() ? customTable.trim() : tableNumber;
      const formattedTable = orderType === 'dine_in' && activeTable
        ? (activeTable.toLowerCase().startsWith('meja') ? activeTable : `Meja ${activeTable}`)
        : undefined;

      // Mapping metode pembayaran untuk database
      let backendPaymentMethod = 'cash';
      let paymentLabel = 'Bayar di Meja (EDC QRIS)';
      if (paymentChoice === 'edc_table') {
        backendPaymentMethod = 'qris';
        paymentLabel = 'Bayar di Meja (Barista bawa EDC QRIS)';
      } else if (paymentChoice === 'cash_table') {
        backendPaymentMethod = 'cash';
        paymentLabel = 'Bayar di Meja (Uang Tunai Pas)';
      } else if (paymentChoice === 'cash_cashier') {
        backendPaymentMethod = 'cash';
        paymentLabel = 'Bayar di Kasir (Lantai 1)';
      } else if (paymentChoice === 'qris_online') {
        backendPaymentMethod = 'qris';
        paymentLabel = 'Scan QRIS Langsung (Transfer)';
      }

      const combinedNote = [
        customerNote.trim(),
        orderType === 'dine_in' ? `[Area: ${selectedAreaObj.label}]` : '',
        `[Metode: ${paymentLabel}]`,
        isTaxEnabled ? `[PB1 Restoran ${taxPercentage}%: ${formatRupiah(taxAmount)}]` : '[Harga Nett]',
      ].filter(Boolean).join(' ');

      const orderPayload = {
        business_id: business.id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_note: combinedNote,
        order_type: orderType,
        table_number: formattedTable,
        seating_area: orderType === 'dine_in' ? selectedAreaObj.label : undefined,
        payment_method: backendPaymentMethod,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: grandTotal,
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

  const primaryColor = settings?.primary_color || '#d97706';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity cursor-pointer" 
        onClick={handleSafeClose} 
      />

      {/* BOTTOM SHEET CONTAINER */}
      <div 
        className="relative z-10 w-full max-w-2xl mx-auto bg-neutral-900 text-neutral-100 rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-slide-up border-t border-neutral-700 overflow-hidden"
      >
        {/* Drag Handle Top Bar */}
        <div className="pt-2.5 pb-1 flex justify-center bg-neutral-900">
          <div className="w-12 h-1 bg-neutral-700 rounded-full" />
        </div>

        {/* Header Bottom Sheet */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Keranjang Pesanan</h2>
              <span className="text-[10px] text-neutral-400 font-medium">Kavarna Coffee Bar & Kitchen</span>
            </div>
            <span className="ml-1 text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
              {cart.length} menu
            </span>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-neutral-950">
          {cart.length === 0 ? (
            <div className="text-center py-14 text-neutral-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 stroke-[1.5] text-neutral-600" />
              <p className="font-medium text-neutral-300">Keranjang masih kosong</p>
              <p className="text-xs mt-1 text-neutral-500">Pilih menu favorit Anda di buku menu untuk memesan.</p>
            </div>
          ) : (
            <>
              {/* Daftar Menu di Keranjang */}
              <div className="space-y-2.5">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-3 bg-neutral-900/90 rounded-2xl border border-neutral-800/80 flex flex-col gap-2"
                  >
                    <div className="flex gap-3">
                      {item.product.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-14 h-14 object-cover rounded-xl shrink-0 border border-neutral-800"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0">
                          ☕
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-neutral-100 truncate">{item.product.name}</h4>
                        <p className="text-xs text-neutral-400 font-medium mt-0.5">
                          {formatRupiah(item.product.price)} x {item.quantity} ={' '}
                          <span className="font-bold text-amber-400">
                            {formatRupiah(item.product.price * item.quantity)}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.product.id)}
                        className="text-neutral-500 hover:text-rose-400 transition p-1.5 self-start cursor-pointer rounded-lg hover:bg-neutral-800"
                        title="Hapus menu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Catatan Item */}
                    <input
                      type="text"
                      placeholder="Catatan menu (misal: less ice, gula aren terpisah)..."
                      value={item.note}
                      onChange={(e) => onUpdateNote(item.product.id, e.target.value)}
                      className="text-xs w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-amber-500 text-neutral-200 placeholder:text-neutral-600"
                    />

                    {/* Kontrol Jumlah */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-neutral-800/60">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center hover:bg-neutral-700 text-neutral-200 transition cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold w-7 text-center text-white">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center hover:bg-neutral-700 text-neutral-200 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form Data Pemesan */}
              <form id="orderForm" onSubmit={handleSubmitOrder} className="space-y-4 pt-3 border-t border-neutral-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ReceiptText className="w-3.5 h-3.5" /> Informasi Pemesanan
                  </h3>
                  <span className="text-[10px] text-neutral-400">Semua pesanan diantar barista</span>
                </div>

                {errorMessage && (
                  <div className="p-3 text-xs bg-rose-950/70 border border-rose-800 text-rose-200 rounded-xl">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Nama Pemesan *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Dimas Aditya"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:border-amber-500 text-white placeholder:text-neutral-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Nomor WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      placeholder="Contoh: 081234567890"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:border-amber-500 text-white placeholder:text-neutral-600"
                    />
                  </div>
                </div>

                {/* Tipe Pesanan */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Tipe Layanan</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderType('dine_in')}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer ${
                        orderType === 'dine_in'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold shadow-xs'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                      }`}
                    >
                      <Utensils className="w-4 h-4" />
                      Dine In (Di Tempat)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('take_away')}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer ${
                        orderType === 'take_away'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold shadow-xs'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Take Away (Bungkus)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('delivery')}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition cursor-pointer ${
                        orderType === 'delivery'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold shadow-xs'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                      }`}
                    >
                      <Bike className="w-4 h-4" />
                      Delivery
                    </button>
                  </div>
                </div>

                {/* SELEKSI AREA & MEJA DINE-IN (1-50 GULIR BEBAS) */}
                {orderType === 'dine_in' && (
                  <div className="p-3.5 bg-neutral-900 rounded-2xl border border-neutral-800 space-y-3.5">
                    
                    {/* 1. Pemilihan Area Duduk */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-400" />
                          Pilih Area Tempat Duduk Anda
                        </label>
                        <span className="text-[10px] text-amber-400 font-semibold">
                          {selectedAreaObj.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {SEATING_AREAS.map((area) => {
                          const isActive = seatingArea === area.id;
                          return (
                            <button
                              key={area.id}
                              type="button"
                              onClick={() => setSeatingArea(area.id)}
                              className={`p-2 rounded-xl text-left border text-xs transition cursor-pointer flex flex-col justify-between ${
                                isActive
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold'
                                  : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                              }`}
                            >
                              <span className="text-[11px] leading-tight line-clamp-2">{area.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Pemilihan Nomor Meja 1-50 (GULIR HORIZONTAL BEBAS) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            Nomor Meja (Pilih dari Stand Meja Besi 1 - 50)
                          </label>
                          <span className="text-[10px] text-neutral-400">
                            Penanda meja besi bebas dipindah. Gulir ke kanan untuk meja lainnya:
                          </span>
                        </div>
                        <span className="text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                          ✓ {customTable.trim() ? customTable : tableNumber}
                        </span>
                      </div>

                      {/* Horizontal Scroll Track 1-50 */}
                      <div className="relative flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => scrollTables('left')}
                          className="w-7 h-9 shrink-0 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-700 transition cursor-pointer"
                          title="Geser Meja Kiri"
                          aria-label="Geser Kiri"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div
                          ref={tableScrollRef}
                          className="flex-1 flex gap-1.5 overflow-x-auto py-1 px-1 scroll-smooth rounded-xl scrollbar-none"
                          style={{ scrollSnapType: 'x proximity' }}
                        >
                          {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => {
                            const padded = num < 10 ? `0${num}` : `${num}`;
                            const label = `Meja ${padded}`;
                            const isSelected = !customTable.trim() && (tableNumber === label || tableNumber === `Meja ${num}` || tableNumber === String(num));

                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => {
                                  setTableNumber(label);
                                  setCustomTable('');
                                }}
                                className={`shrink-0 py-2 px-3 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer min-w-[62px] ${
                                  isSelected
                                    ? 'bg-amber-500 text-neutral-950 shadow-md font-black ring-2 ring-amber-400 scale-105'
                                    : 'bg-neutral-950 text-neutral-300 border border-neutral-800 hover:border-amber-500/60 hover:bg-neutral-800'
                                }`}
                                style={{ scrollSnapAlign: 'start' }}
                              >
                                <span className="text-xs font-mono">{padded}</span>
                                <span className="text-[9px] opacity-80 uppercase tracking-tighter">Meja</span>
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => scrollTables('right')}
                          className="w-7 h-9 shrink-0 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-700 transition cursor-pointer"
                          title="Geser Meja Kanan"
                          aria-label="Geser Kanan"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Manual input if special spot */}
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Atau ketik nama/nomor meja custom (contoh: Sofa Depan Bar)..."
                          value={customTable}
                          onChange={(e) => setCustomTable(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg focus:outline-none focus:border-amber-500 text-white placeholder:text-neutral-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* METODE PEMBAYARAN KAVARNA (REALISTIS & PRAKTIS) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-neutral-200">Pilih Metode Pembayaran</label>
                    <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      Tamu Cukup Duduk di Meja
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Opsi 1: Bayar di Meja via EDC QRIS Barista (Rekomendasi Utama) */}
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('edc_table')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer relative ${
                        paymentChoice === 'edc_table'
                          ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500 shadow-xs'
                          : 'border-neutral-800 bg-neutral-900 hover:bg-neutral-850'
                      }`}
                    >
                      <span className="absolute top-2.5 right-2.5 text-[9px] bg-amber-500 text-neutral-950 font-black px-1.5 py-0.5 rounded-full">
                        Rekomendasi Meja
                      </span>
                      <div className="flex items-center gap-2">
                        <CreditCard className={`w-4 h-4 ${paymentChoice === 'edc_table' ? 'text-amber-400' : 'text-neutral-400'}`} />
                        <span className={`text-xs font-bold ${paymentChoice === 'edc_table' ? 'text-amber-300' : 'text-neutral-200'}`}>
                          Bayar di Meja (EDC QRIS Barista)
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 leading-tight">
                        Barista bawa mesin EDC QRIS/Kartu saat antar pesanan ke meja. Anda scan langsung di alat EDC.
                      </span>
                    </button>

                    {/* Opsi 2: Bayar di Meja via Tunai */}
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('cash_table')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer relative ${
                        paymentChoice === 'cash_table'
                          ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500 shadow-xs'
                          : 'border-neutral-800 bg-neutral-900 hover:bg-neutral-850'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Banknote className={`w-4 h-4 ${paymentChoice === 'cash_table' ? 'text-amber-400' : 'text-neutral-400'}`} />
                        <span className={`text-xs font-bold ${paymentChoice === 'cash_table' ? 'text-amber-300' : 'text-neutral-200'}`}>
                          Bayar di Meja (Tunai Pas)
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 leading-tight">
                        Siapkan uang pas di meja saat pesanan diantar oleh barista Kavarna.
                      </span>
                    </button>

                    {/* Opsi 3: Bayar Langsung ke Meja Kasir */}
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('cash_cashier')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer relative ${
                        paymentChoice === 'cash_cashier'
                          ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500 shadow-xs'
                          : 'border-neutral-800 bg-neutral-900 hover:bg-neutral-850'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Utensils className={`w-4 h-4 ${paymentChoice === 'cash_cashier' ? 'text-amber-400' : 'text-neutral-400'}`} />
                        <span className={`text-xs font-bold ${paymentChoice === 'cash_cashier' ? 'text-amber-300' : 'text-neutral-200'}`}>
                          Bayar di Kasir (Lantai 1)
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 leading-tight">
                        Bagi Anda yang ingin bertransaksi langsung di meja kasir lantai 1.
                      </span>
                    </button>

                    {/* Opsi 4: Scan QRIS di Layar HP */}
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('qris_online')}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 cursor-pointer relative ${
                        paymentChoice === 'qris_online'
                          ? 'border-rose-500 bg-rose-500/20 ring-1 ring-rose-500 shadow-xs'
                          : 'border-neutral-800 bg-neutral-900 hover:bg-neutral-850'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <QrCode className={`w-4 h-4 ${paymentChoice === 'qris_online' ? 'text-rose-400' : 'text-neutral-400'}`} />
                        <span className={`text-xs font-bold ${paymentChoice === 'qris_online' ? 'text-rose-300' : 'text-neutral-200'}`}>
                          Scan QRIS di HP Sekarang
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 leading-tight">
                        Tampilkan QRIS statis toko di layar HP untuk transfer m-Banking / E-Wallet sekarang.
                      </span>
                    </button>
                  </div>

                  {/* KARTU PREVIEW QRIS (Hanya jika opsi scan dipilih) */}
                  {paymentChoice === 'qris_online' && (
                    <div className="p-3.5 bg-neutral-900 rounded-2xl border border-rose-500/40 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="bg-rose-600 text-white text-[11px] font-black px-2 py-0.5 rounded">
                            QRIS
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-neutral-200 uppercase">
                              {paymentConfig.qris_merchant_name || business.name}
                            </div>
                            <div className="text-[9px] font-mono text-neutral-500">
                              NMID: {paymentConfig.qris_nmid || 'ID1020261928374'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Siap Scan
                        </span>
                      </div>

                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-inner">
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

                        <div className="mt-2 text-center text-neutral-900">
                          <span className="text-[10px] text-neutral-500 block">Nominal Pembayaran Pas:</span>
                          <span className="text-base font-black font-mono">
                            {formatRupiah(grandTotal)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadQris}
                          className="flex-1 py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-[11px] font-semibold text-neutral-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Unduh QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(String(grandTotal), 'qris_total')}
                          className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-[11px] font-semibold text-neutral-200 flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedField === 'qris_total' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-bold">Disalin</span>
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Catatan Tambahan untuk Barista</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Meja tolong dibersihkan dulu, sedotan kertas..."
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:border-amber-500 text-white placeholder:text-neutral-600"
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Checkout Sticky */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-neutral-800 bg-neutral-900">
            {/* Rincian Subtotal & Pajak PB1 */}
            <div className="space-y-1 mb-3 text-xs">
              <div className="flex justify-between items-center text-neutral-400">
                <span>Subtotal ({cart.length} menu)</span>
                <span className="font-semibold text-neutral-200">{formatRupiah(subtotal)}</span>
              </div>

              {isTaxEnabled && (
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Pajak Restoran (PB1 {taxPercentage}%)</span>
                  <span className="font-semibold text-amber-400">+{formatRupiah(taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1.5 border-t border-neutral-800 text-sm">
                <div>
                  <span className="font-bold text-white block">Total Pembayaran</span>
                  <span className="text-[10px] text-neutral-500">
                    {isTaxEnabled ? 'Termasuk Pajak PB1' : 'Harga Nett'} • Tanpa Kode Unik
                  </span>
                </div>
                <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                  {formatRupiah(grandTotal)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              form="orderForm"
              disabled={isSubmitting}
              style={{ backgroundColor: primaryColor }}
              className="w-full py-3 px-4 text-neutral-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition hover:brightness-110 disabled:opacity-50 cursor-pointer text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                  Mengirim Pesanan ke Barista...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-neutral-950" />
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