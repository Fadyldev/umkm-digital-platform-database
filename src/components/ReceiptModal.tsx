import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  Copy, 
  Check, 
  Share2, 
  MessageCircle, 
  FileText, 
  Smartphone,
  Info,
  SlidersHorizontal
} from 'lucide-react';
import { Order, Business } from '../types';

interface ReceiptModalProps {
  order: Order | null;
  business: Business;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, business, onClose }) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [copiedText, setCopiedText] = useState(false);
  const [printStatus, setPrintStatus] = useState<string>('');

  if (!order) return null;

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const orderDate = new Date(order.created_at).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generator Teks Struk Standar Printer Thermal (ESC/POS / RawBT / Bluetooth POS)
  const generateThermalReceiptText = (): string => {
    const divider = '================================';
    const thinDivider = '--------------------------------';
    let text = '';
    text += `${business.name.toUpperCase()}\n`;
    if (business.address) text += `${business.address}\n`;
    if (business.phone) text += `Telp/WA: ${business.phone}\n`;
    text += `${divider}\n`;
    text += `No. Order : ${order.order_number}\n`;
    text += `Waktu     : ${orderDate}\n`;
    text += `Pelanggan : ${order.customer_name}\n`;
    text += `Layanan   : ${order.order_type === 'dine_in' ? `DINE-IN (${order.table_number || 'Meja Umum'})` : order.order_type.toUpperCase()}\n`;
    text += `Bayar Via : ${order.payment_method.toUpperCase()} (${order.payment_status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'})\n`;
    text += `${thinDivider}\n`;
    text += `ITEM PESANAN              TOTAL\n`;
    text += `${thinDivider}\n`;

    (order.items || []).forEach((it) => {
      const itemTitle = `${it.quantity}x ${it.product_name}`;
      const itemSub = formatRupiah(it.subtotal);
      text += `${itemTitle.padEnd(20).slice(0, 20)} ${itemSub.padStart(11)}\n`;
      if (it.item_note) {
        text += `  * Catatan: ${it.item_note}\n`;
      }
    });

    text += `${divider}\n`;
    text += `TOTAL BAYAR: ${formatRupiah(order.total_amount)}\n`;
    text += `${divider}\n`;
    text += `     *** TERIMA KASIH ***\n`;
    text += `  Selamat Menikmati Pesanan!\n`;
    text += `  Powered by UMKM Digital Platform\n`;
    return text;
  };

  const handleCopyReceiptText = async () => {
    try {
      const text = generateThermalReceiptText();
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch (err) {
      console.warn('Gagal salin teks struk:', err);
    }
  };

  const handlePrint = () => {
    setPrintStatus('Membuka dialog cetak browser...');
    try {
      // Panggil window.print()
      window.print();
      setTimeout(() => setPrintStatus(''), 2500);
    } catch (err) {
      console.warn('Gagal memanggil window.print():', err);
      setPrintStatus('Browser memblokir print di dalam iframe. Gunakan tombol "Salin Teks" atau "Kirim WhatsApp" di bawah.');
    }
  };

  const handleSendToWhatsApp = () => {
    const rawPhone = (order.customer_phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;
    const textReceipt = encodeURIComponent(
      `*STRUK DIGITAL ${business.name.toUpperCase()}*\n\n` +
      `No. Pesanan: ${order.order_number}\n` +
      `Tanggal: ${orderDate}\n` +
      `Pelanggan: ${order.customer_name}\n` +
      `Meja/Layanan: ${order.order_type === 'dine_in' ? (order.table_number || 'Dine-In') : order.order_type}\n` +
      `Metode Bayar: ${order.payment_method.toUpperCase()} (${order.payment_status === 'paid' ? 'Lunas' : 'Belum Lunas'})\n\n` +
      `*Rincian Pesanan:*\n` +
      (order.items || []).map((it) => `- ${it.quantity}x ${it.product_name} = ${formatRupiah(it.subtotal)}`).join('\n') +
      `\n\n*TOTAL: ${formatRupiah(order.total_amount)}*\n\n` +
      `Terima kasih telah berkunjung ke ${business.name}! 🙏`
    );

    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${textReceipt}`
      : `https://wa.me/?text=${textReceipt}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in print:p-0 print:bg-white overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative text-neutral-800 my-auto print:shadow-none print:max-w-none print:w-full print:p-0">
        
        {/* Tombol Tutup */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition print:hidden"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Dialog */}
        <div className="mb-4 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-700" />
            <h3 className="text-base font-bold text-neutral-900">Cetak Struk Kasir</h3>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Format struk standar thermal POS (Dine In & Take Away)
          </p>

          {/* Toggle Ukuran Kertas */}
          <div className="mt-3 flex items-center justify-between bg-neutral-100 p-1.5 rounded-xl text-xs">
            <span className="font-semibold text-neutral-600 pl-2 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Lebar Kertas:
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  paperWidth === '58mm'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                58mm (Mini Warkop)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  paperWidth === '80mm'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                80mm (Standar POS)
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TAMPILAN KERTAS STRUK THERMAL ASLI */}
        {/* ========================================================= */}
        <div 
          className={`mx-auto bg-neutral-50 p-4 sm:p-5 rounded-2xl border-2 border-dashed border-neutral-300 font-mono text-xs text-neutral-900 shadow-inner space-y-3 transition-all ${
            paperWidth === '58mm' ? 'max-w-xs' : 'max-w-sm'
          }`}
        >
          {/* Header Toko */}
          <div className="text-center pb-2.5 border-b border-dashed border-neutral-300">
            <h2 className="text-base font-black uppercase tracking-wider text-neutral-900">
              {business.name}
            </h2>
            {business.address && (
              <p className="text-[11px] text-neutral-600 mt-0.5 leading-tight">{business.address}</p>
            )}
            {business.phone && (
              <p className="text-[11px] text-neutral-500 mt-0.5">Telp: {business.phone}</p>
            )}
          </div>

          {/* Info Transaksi & Nomor Meja */}
          <div className="text-[11px] space-y-1 py-1 border-b border-dashed border-neutral-300">
            <div className="flex justify-between">
              <span className="text-neutral-500">No. Order:</span>
              <span className="font-bold">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Waktu:</span>
              <span>{orderDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Pelanggan:</span>
              <span className="font-semibold">{order.customer_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-500">Layanan:</span>
              <span className="font-black px-1.5 py-0.5 bg-neutral-200 rounded text-neutral-900 uppercase">
                {order.order_type === 'dine_in' 
                  ? `${order.table_number || 'Meja Umum'}` 
                  : order.order_type.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Rincian Menu */}
          <div className="py-2 border-b border-dashed border-neutral-300 space-y-2">
            <div className="flex justify-between text-[10px] text-neutral-400 uppercase font-semibold">
              <span>Item Menu</span>
              <span>Subtotal</span>
            </div>
            {(order.items || []).map((it, idx) => (
              <div key={idx} className="space-y-0.5 text-[11px]">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium text-neutral-800">
                    <strong className="text-neutral-900">{it.quantity}x</strong> {it.product_name}
                  </span>
                  <span className="font-bold text-neutral-900 shrink-0">{formatRupiah(it.subtotal)}</span>
                </div>
                {it.item_note && (
                  <div className="text-[10px] text-neutral-500 italic pl-3">
                    * Catatan: {it.item_note}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Total & Pembayaran */}
          <div className="pt-1 pb-2 border-b border-dashed border-neutral-300 space-y-1.5">
            <div className="flex justify-between text-sm font-black pt-1">
              <span>TOTAL BAYAR</span>
              <span className="text-neutral-900">{formatRupiah(order.total_amount)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-500">Metode Bayar:</span>
              <span className="font-bold uppercase">{order.payment_method}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-500">Status Bayar:</span>
              <span className={`font-black uppercase px-1.5 py-0.5 rounded text-[10px] ${
                order.payment_status === 'paid' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {order.payment_status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}
              </span>
            </div>
          </div>

          {/* Footer Struk */}
          <div className="text-center pt-2 text-[10px] text-neutral-500 space-y-0.5">
            <p className="font-bold text-neutral-700">*** TERIMA KASIH ***</p>
            <p>Selamat menikmati pesanan Anda!</p>
            <p className="text-[9px] text-neutral-400 pt-1">UMKM Digital Platform</p>
          </div>
        </div>

        {/* Notifikasi Status Print jika iframe membatasi */}
        {printStatus && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl print:hidden">
            {printStatus}
          </div>
        )}

        {/* Penjelasan Alat Fisik */}
        <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2 print:hidden">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Tidak harus ada alat printer fisik sekarang!</strong> Anda bisa langsung preview di layar, cetak PDF di komputer, kirim struk ke WhatsApp pelanggan, atau salin format teks ke aplikasi printer bluetooth kasir (seperti RawBT / iReap).
          </p>
        </div>

        {/* Tombol Aksi Lengkap (Hanya di layar, disembunyikan saat dicetak) */}
        <div className="mt-4 space-y-2 print:hidden">
          {/* Tombol Cetak Browser */}
          <button
            onClick={handlePrint}
            className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak Struk (Browser Print / PDF)
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Tombol Salin Teks Format Thermal ESC/POS */}
            <button
              onClick={handleCopyReceiptText}
              className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                copiedText
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-neutral-300 hover:bg-neutral-50 text-neutral-700'
              }`}
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Tersalin ke Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Salin Teks (RawBT / POS)
                </>
              )}
            </button>

            {/* Tombol Kirim WhatsApp */}
            <button
              onClick={handleSendToWhatsApp}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Kirim ke WA Pelanggan
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            Tutup Jendela Struk
          </button>
        </div>
      </div>
    </div>
  );
};
