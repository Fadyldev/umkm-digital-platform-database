import React, { useState, useEffect } from 'react';
import { CheckCircle2, MessageCircle, X, QrCode, Download, ShieldCheck, Banknote } from 'lucide-react';
import QRCode from 'qrcode';
import { Order, Business, Setting, PaymentConfig } from '../types';

interface OrderSuccessModalProps {
  order: Order | null;
  business: Business;
  settings?: Setting | null;
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ order, business, settings, onClose }) => {
  const [qrisQrDataUrl, setQrisQrDataUrl] = useState<string>('');

  // Sinkronisasi tombol Back browser agar menutup modal bukan keluar website
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
    qris_merchant_name: business.name || 'Warkop Nusantara',
    qris_nmid: 'ID1020261928374',
    cash_enabled: true,
  };

  useEffect(() => {
    if (order && order.payment_method === 'qris' && order.total_amount > 0) {
      const merchant = (paymentConfig.qris_merchant_name || business.name || 'Warkop Nusantara').toUpperCase();
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-neutral-800 my-8">
        <button
          onClick={handleSafeClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition cursor-pointer p-1"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2.5">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Pesanan Berhasil Dibuat!</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Pesanan Anda telah dicatat oleh sistem kasir {business.name}.
          </p>
        </div>

        {/* Ringkasan Pesanan */}
        <div className="bg-neutral-50 rounded-xl p-3.5 mb-4 border border-neutral-200 text-xs space-y-1.5">
          <div className="flex justify-between items-center pb-1.5 border-b border-neutral-200">
            <span className="text-neutral-500 font-medium">Nomor Pesanan</span>
            <span className="font-mono font-bold text-neutral-900 text-sm">{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Nama Pelanggan</span>
            <span className="font-medium text-neutral-900">{order.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Tipe Pesanan</span>
            <span className="font-medium capitalize text-neutral-900">
              {order.order_type === 'dine_in' ? `Dine In (${order.table_number || 'Meja Umum'})` : order.order_type}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Metode Bayar</span>
            <span className={`font-bold uppercase px-2 py-0.5 rounded text-[11px] ${
              order.payment_method === 'qris'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {order.payment_method === 'qris' ? 'QRIS Digital' : 'Tunai di Kasir'}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-neutral-200">
            <span className="font-bold text-neutral-800">Total Tagihan</span>
            <span className="font-bold text-emerald-600 text-base">{formatRupiah(order.total_amount)}</span>
          </div>
        </div>

        {/* TAMPILAN PEMBAYARAN SESUAI METODE */}
        {order.payment_method === 'qris' ? (
          <div className="mb-4 p-3 bg-red-50/50 rounded-xl border border-red-200 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-red-900">
              <QrCode className="w-4 h-4 text-red-600" />
              <span>Silakan Scan QRIS untuk Menyelesaikan Pembayaran</span>
            </div>
            {paymentConfig.qris_image_url || qrisQrDataUrl ? (
              <div className="inline-block p-2 bg-white rounded-xl shadow-xs border border-neutral-200">
                <img 
                  src={paymentConfig.qris_image_url || qrisQrDataUrl} 
                  alt="QRIS" 
                  className="w-40 h-40 object-contain mx-auto" 
                />
              </div>
            ) : null}
            <div className="text-[11px] text-neutral-500">
              Mendukung GoPay, OVO, DANA, BCA, Livin, BRImo, ShopeePay
            </div>
            <button
              type="button"
              onClick={handleDownloadQris}
              className="text-xs font-semibold text-red-700 hover:text-red-800 underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh Gambar QRIS
            </button>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-neutral-100 rounded-xl border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2">
            <Banknote className="w-4 h-4 text-neutral-700 mt-0.5 shrink-0" />
            <div>
              <strong className="text-neutral-900 block font-semibold">Pembayaran Tunai di Kasir</strong>
              <span className="text-[11px]">
                Silakan siapkan uang pas sebesar <strong>{formatRupiah(order.total_amount)}</strong> saat hidangan disajikan di meja atau langsung ke meja kasir.
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleSendToWhatsApp}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer text-xs"
          >
            <MessageCircle className="w-4 h-4" />
            Konfirmasi Pesanan via WhatsApp
          </button>
          <button
            onClick={handleSafeClose}
            className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-medium transition cursor-pointer text-xs"
          >
            Tutup & Kembali ke Menu
          </button>
        </div>
      </div>
    </div>
  );
};
