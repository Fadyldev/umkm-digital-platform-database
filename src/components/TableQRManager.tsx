import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  Download, 
  Printer, 
  ExternalLink, 
  Check, 
  Copy,
  Globe,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { Business } from '../types';

interface TableQRManagerProps {
  business: Business;
}

interface TableQRItem {
  tableNumber: number;
  label: string;
  zone: string;
  url: string;
  qrDataUrl: string;
}

export const TableQRManager: React.FC<TableQRManagerProps> = ({ business }) => {
  const [baseUrlInput, setBaseUrlInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  });
  const [activeBaseUrl, setActiveBaseUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  });

  // Master Universal QR Code
  const [masterQrDataUrl, setMasterQrDataUrl] = useState<string>('');
  const [isCopiedMaster, setIsCopiedMaster] = useState<boolean>(false);

  // Optional: Per-table generation
  const [showIndividualQRs, setShowIndividualQRs] = useState<boolean>(false);
  const [tableCount, setTableCount] = useState<number>(50);
  const [qrList, setQrList] = useState<TableQRItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);

  const cleanBase = (activeBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  const masterUrl = `${cleanBase}/?source=meja`;

  const isLocalOrPreview = 
    activeBaseUrl.includes('localhost') || 
    activeBaseUrl.includes('127.0.0.1') || 
    activeBaseUrl.includes('.aistudio.') ||
    activeBaseUrl.includes('webcontainer');

  // Generate Master Universal QR Code
  useEffect(() => {
    QRCode.toDataURL(masterUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#121214',
        light: '#ffffff',
      },
    })
      .then((url) => setMasterQrDataUrl(url))
      .catch((err) => console.error('Gagal generate master QR:', err));
  }, [masterUrl]);

  // Generate individual QRs if user opens accordion
  useEffect(() => {
    if (showIndividualQRs) {
      generateIndividualQRCodes(tableCount, cleanBase);
    }
  }, [showIndividualQRs, tableCount, cleanBase]);

  const generateIndividualQRCodes = async (count: number, base: string) => {
    try {
      setIsGenerating(true);
      const items: TableQRItem[] = [];

      for (let i = 1; i <= count; i++) {
        const paddedNum = i < 10 ? `0${i}` : `${i}`;
        const label = `Meja ${paddedNum}`;
        const targetUrl = `${base}/?meja=${i}`;

        const dataUrl = await QRCode.toDataURL(targetUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#1e1e24',
            light: '#ffffff',
          },
        });

        items.push({
          tableNumber: i,
          label,
          zone: 'Stand Meja Bebas (1-50)',
          url: targetUrl,
          qrDataUrl: dataUrl,
        });
      }

      setQrList(items);
    } catch (err) {
      console.error('Gagal generate per-table QR Code:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyBaseUrl = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = baseUrlInput.trim();
    if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }
    setActiveBaseUrl(cleaned);
  };

  const handleResetToOrigin = () => {
    const origin = window.location.origin;
    setBaseUrlInput(origin);
    setActiveBaseUrl(origin);
  };

  const handleDownloadMasterQR = () => {
    if (!masterQrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR-MASTER-${business.slug || 'kavarna'}-UNIVERSAL.png`;
    link.href = masterQrDataUrl;
    link.click();
  };

  const handleCopyMasterLink = async () => {
    try {
      await navigator.clipboard.writeText(masterUrl);
      setIsCopiedMaster(true);
      setTimeout(() => setIsCopiedMaster(false), 2500);
    } catch (err) {
      console.warn('Gagal salin link:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. KONTROL URL DOMAIN PUBLIK */}
      <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-500" />
              Alamat Web Tujuan QR Code (Domain Publik Vercel):
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Masukkan domain live website Anda agar saat dicetak, QR Code langsung dapat di-scan dari HP seluruh pengunjung.
            </p>
          </div>

          <form onSubmit={handleApplyBaseUrl} className="flex items-center gap-2">
            <input
              type="text"
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              placeholder="https://namaproject.vercel.app"
              className="w-64 sm:w-80 px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 rounded-lg text-xs font-bold cursor-pointer transition whitespace-nowrap"
            >
              Terapkan
            </button>
            {baseUrlInput !== window.location.origin && (
              <button
                type="button"
                onClick={handleResetToOrigin}
                className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium cursor-pointer transition whitespace-nowrap"
                title="Kembalikan ke URL saat ini"
              >
                Reset
              </button>
            )}
          </form>
        </div>

        {isLocalOrPreview && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block text-amber-300">Tips Sebelum Mencetak Akrilik Meja:</strong>
              <span>
                Masukkan domain resmi Vercel Anda di kotak di atas (contoh: <code>https://kavarna-coffee.vercel.app</code>) lalu klik <strong>Terapkan</strong> sebelum mengunduh atau mencetak barcode.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. MASTER UNIVERSAL QR CODE MEJA (STAND AKRILIK) */}
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* Sisi Kiri: Penjelasan Bisnis & Tombol Cetak */}
          <div className="flex-1 space-y-4 text-center lg:text-left print:hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Satu QR Code Universal untuk Semua Meja 1-50
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Master Stand Akrilik QR Code Kavarna
            </h3>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-xl">
              <strong>Solusi Praktis & Efisien:</strong> Anda tidak perlu mencetak 50 QR berbeda yang rumit. Cukup cetak 1 Master QR ini di stand akrilik meja. Tamu cukup scan dari HP mereka, lalu memilih sendiri Area (Lt. 1 / Lt. 2 Indoor / Lt. 2 Outdoor / VIP) dan Nomor Meja (1-50) sesuai stand besi yang ada di depan mereka!
            </p>

            {/* Alur Kerja 3 Langkah */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-left">
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                <span className="text-[10px] text-amber-400 font-black block">LANGKAH 1</span>
                <span className="text-xs font-bold text-white block mt-0.5">Scan QR di Meja</span>
                <span className="text-[10px] text-neutral-400 mt-1 block">Tamu scan dengan kamera HP tanpa unduh aplikasi.</span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                <span className="text-[10px] text-amber-400 font-black block">LANGKAH 2</span>
                <span className="text-xs font-bold text-white block mt-0.5">Pilih Menu & Meja</span>
                <span className="text-[10px] text-neutral-400 mt-1 block">Pilih menu, tentukan area & nomor meja (1-50) via gulir.</span>
              </div>
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                <span className="text-[10px] text-amber-400 font-black block">LANGKAH 3</span>
                <span className="text-xs font-bold text-white block mt-0.5">Barista Antar ke Meja</span>
                <span className="text-[10px] text-neutral-400 mt-1 block">Barista antar pesanan membawa EDC QRIS / Uang Pas.</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-3">
              <button
                onClick={handlePrint}
                className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak Format Stand Akrilik Meja (Print)
              </button>

              <button
                onClick={handleDownloadMasterQR}
                className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Unduh Gambar QR (PNG Resolusi Tinggi)
              </button>

              <button
                onClick={handleCopyMasterLink}
                className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl text-xs flex items-center gap-1.5 border border-neutral-700 transition cursor-pointer"
              >
                {isCopiedMaster ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sisi Kanan: TENT CARD / STAND AKRILIK PREVIEW */}
          <div className="w-full max-w-[320px] bg-neutral-950 text-white rounded-3xl p-6 border-2 border-amber-500/40 shadow-2xl flex flex-col items-center text-center relative overflow-hidden print:w-full print:max-w-none print:shadow-none print:border-none print:text-neutral-900 print:bg-white">
            
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-neutral-950 font-black flex items-center justify-center text-2xl shadow-md mb-2 print:bg-neutral-900 print:text-white">
              K
            </div>

            <h4 className="text-base font-extrabold tracking-tight text-white uppercase print:text-neutral-900">
              {business.name || 'KAVARNA COFFEE BAR & KITCHEN'}
            </h4>
            <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider print:text-neutral-600">
              Digital Table Ordering • Scan to Order
            </p>

            <div className="my-4 p-3 bg-white rounded-2xl shadow-lg border border-neutral-200">
              {masterQrDataUrl ? (
                <img
                  src={masterQrDataUrl}
                  alt="Master QR Code Kavarna"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-neutral-400">
                  <QrCode className="w-12 h-12 animate-pulse" />
                </div>
              )}
            </div>

            <div className="space-y-1 text-center w-full">
              <span className="text-xs font-bold text-white block print:text-neutral-900">
                Pesan & Bayar Tanpa Antre ke Kasir
              </span>
              <p className="text-[10px] text-neutral-400 leading-tight print:text-neutral-600">
                1. Arahkan kamera HP ke QR Code<br />
                2. Pilih menu, area & nomor meja Anda (1-50)<br />
                3. Barista menyajikan ke meja Anda
              </p>
              <div className="pt-2 border-t border-neutral-800 print:border-neutral-300 mt-2">
                <span className="text-[9px] font-mono text-neutral-500 print:text-neutral-600 truncate block">
                  {masterUrl}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. OPSIONAL: GENERATOR QR PER NOMOR MEJA SPESIFIK */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden print:hidden">
        <button
          onClick={() => setShowIndividualQRs(!showIndividualQRs)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-neutral-850 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-amber-500" />
            <div>
              <span className="text-xs font-bold text-white block">
                Ingin Cetak QR Terpisah Tiap Meja 1-50? (Opsional)
              </span>
              <span className="text-[11px] text-neutral-400">
                Klik untuk menampilkan generator QR Code spesifik (?meja=1 s/d ?meja=50)
              </span>
            </div>
          </div>
          {showIndividualQRs ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </button>

        {showIndividualQRs && (
          <div className="p-5 border-t border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <label className="font-semibold text-neutral-300">Pilih Jumlah Meja:</label>
                <select
                  value={tableCount}
                  onChange={(e) => setTableCount(Number(e.target.value))}
                  className="px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                >
                  {[10, 20, 30, 40, 50].map((num) => (
                    <option key={num} value={num}>
                      {num} Meja (Stand 1 - {num})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handlePrint}
                className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Seluruh {tableCount} QR Stand
              </button>
            </div>

            {isGenerating ? (
              <div className="py-8 text-center text-neutral-400 text-xs">
                Membuat QR Code untuk {tableCount} meja...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {qrList.map((item, idx) => (
                  <div
                    key={item.tableNumber}
                    className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col items-center text-center space-y-2 hover:border-amber-500/50 transition"
                  >
                    <div className="w-full flex items-center justify-between text-[11px] font-bold">
                      <span className="text-amber-400">{item.label}</span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-neutral-500 hover:text-white transition"
                        title="Buka Link Meja"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <img
                      src={item.qrDataUrl}
                      alt={item.label}
                      className="w-28 h-28 object-contain bg-white p-1 rounded-lg"
                    />

                    <div className="flex gap-1.5 w-full pt-1">
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.download = `QR-Kavarna-${item.label.replace(/\s+/g, '-')}.png`;
                          link.href = item.qrDataUrl;
                          link.click();
                        }}
                        className="flex-1 py-1 px-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Download className="w-3 h-3" />
                        Unduh
                      </button>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(item.url);
                          setCopiedUrlIndex(idx);
                          setTimeout(() => setCopiedUrlIndex(null), 2000);
                        }}
                        className="py-1 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[10px] cursor-pointer transition"
                      >
                        {copiedUrlIndex === idx ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};