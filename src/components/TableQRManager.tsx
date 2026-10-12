import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  Download, 
  Printer, 
  ExternalLink, 
  RefreshCw, 
  Info, 
  Check, 
  Copy
} from 'lucide-react';
import { Business } from '../types';

interface TableQRManagerProps {
  business: Business;
}

interface TableQRItem {
  tableNumber: number;
  label: string;
  url: string;
  qrDataUrl: string;
}

export const TableQRManager: React.FC<TableQRManagerProps> = ({ business }) => {
  const [tableCount, setTableCount] = useState<number>(10);
  const [qrList, setQrList] = useState<TableQRItem[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);

  useEffect(() => {
    generateAllQRCodes(tableCount);
  }, [business.slug, tableCount]);

  const generateAllQRCodes = async (count: number) => {
    try {
      setIsGenerating(true);
      const baseUrl = window.location.origin;
      const items: TableQRItem[] = [];

      for (let i = 1; i <= count; i++) {
        const paddedNum = i < 10 ? `0${i}` : `${i}`;
        const label = `Meja ${paddedNum}`;
        const targetUrl = `${baseUrl}/?meja=${i}`;

        const dataUrl = await QRCode.toDataURL(targetUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff',
          },
        });

        items.push({
          tableNumber: i,
          label,
          url: targetUrl,
          qrDataUrl: dataUrl,
        });
      }

      setQrList(items);
    } catch (err) {
      console.error('Gagal generate QR Code:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadQR = (qrItem: TableQRItem) => {
    const link = document.createElement('a');
    link.download = `QR-${business.slug}-${qrItem.label.replace(/\s+/g, '-')}.png`;
    link.href = qrItem.qrDataUrl;
    link.click();
  };

  const handleCopyLink = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrlIndex(index);
      setTimeout(() => setCopiedUrlIndex(null), 2500);
    } catch (err) {
      console.warn('Gagal salin link:', err);
    }
  };

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Kontrol & Keterangan Atas (Sembunyi saat print) */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-700" />
              <h3 className="text-sm font-bold text-neutral-900">Generator Stand QR Code Meja</h3>
            </div>
            <p className="text-xs text-neutral-500 mt-1 max-w-xl">
              Cetak stand QR Code untuk ditaruh di atas meja warkop. Pelanggan cukup scan dengan kamera HP untuk langsung memilih menu tanpa antre ke kasir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-neutral-700">Jumlah Meja:</label>
              <select
                value={tableCount}
                onChange={(e) => setTableCount(Number(e.target.value))}
                className="px-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {[5, 10, 15, 20, 25, 30].map((num) => (
                  <option key={num} value={num}>
                    {num} Meja
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePrintAll}
              className="py-2 px-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak Stand Meja (Print All)
            </button>
          </div>
        </div>

        {/* Link QR Code Otomatis */}
        <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-neutral-700">Link QR Otomatis:</span>
            <code className="font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {window.location.origin}/?meja=XX
            </code>
          </div>
          <span className="text-[11px] text-neutral-400">
            ✓ Otomatis terhubung dengan alamat domain saat website dideploy
          </span>
        </div>
      </div>

      {/* Grid Kartu QR Meja */}
      {isGenerating ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-neutral-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
          <p className="text-xs text-neutral-500 font-medium">Membuat gambar QR Code untuk {tableCount} meja...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 print:grid-cols-2 print:gap-6">
          {qrList.map((item, idx) => (
            <div
              key={item.tableNumber}
              className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center text-center transition hover:shadow-md print:shadow-none print:border-2 print:border-neutral-900 print:rounded-2xl"
            >
              {/* Header Kartu Stand Meja */}
              <div className="mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  {business.name}
                </span>
                <h4 className="text-lg font-black text-neutral-900 mt-0.5">{item.label}</h4>
              </div>

              {/* Gambar QR Code */}
              <div className="p-2 bg-white rounded-xl border border-neutral-100 shadow-inner my-1">
                <img
                  src={item.qrDataUrl}
                  alt={`QR ${item.label}`}
                  className="w-40 h-40 object-contain mx-auto"
                />
              </div>

              <p className="text-[11px] font-semibold text-neutral-600 mt-1">
                Scan Kamera HP untuk Pesan
              </p>
              <p className="text-[9px] text-neutral-400 truncate max-w-full px-2 mt-0.5 font-mono print:hidden">
                {item.url}
              </p>

              {/* Tombol Aksi (Sembunyi saat print) */}
              <div className="mt-4 pt-3 border-t border-neutral-100 w-full flex flex-wrap items-center justify-center gap-1.5 print:hidden">
                <button
                  onClick={() => handleDownloadQR(item)}
                  className="py-1 px-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Download Gambar PNG"
                >
                  <Download className="w-3 h-3" />
                  PNG
                </button>
                <button
                  onClick={() => handleCopyLink(item.url, idx)}
                  className="py-1 px-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Salin Alamat Link"
                >
                  {copiedUrlIndex === idx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Salin Link
                    </>
                  )}
                </button>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
                  title="Uji Buka Halaman Meja Ini"
                >
                  <ExternalLink className="w-3 h-3" />
                  Buka
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
