import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { Order } from '../types';

interface RevenueChartProps {
  orders: Order[];
}

type PeriodType = 'weekly' | 'monthly' | 'yearly';

const formatRupiah = (val: number): string => {
  return 'Rp ' + (val || 0).toLocaleString('id-ID');
};

const formatShortRupiah = (val: number): string => {
  if (val >= 1_000_000_000) {
    return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  }
  if (val >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(1)}jt`;
  }
  if (val >= 1_000) {
    return `Rp ${(val / 1_000).toFixed(0)}rb`;
  }
  return `Rp ${val}`;
};

export const RevenueChart: React.FC<RevenueChartProps> = ({ orders }) => {
  const [period, setPeriod] = useState<PeriodType>('weekly');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [includeOnlyCompleted, setIncludeOnlyCompleted] = useState<boolean>(true);

  // Filter orders berdasarkan status
  const validOrders = useMemo(() => {
    return orders.filter((o) => {
      if (includeOnlyCompleted) {
        return o.status === 'completed' || o.payment_status === 'paid';
      }
      return o.status !== 'cancelled';
    });
  }, [orders, includeOnlyCompleted]);

  // Generate data grafik sesuai periode yang dipilih
  const chartData = useMemo(() => {
    const now = new Date();

    // 1. MINGGUAN: Senin s/d Minggu (Urutan kalender resmi: Senin paling kiri, Minggu paling kanan)
    if (period === 'weekly') {
      const currentDay = now.getDay(); // 0: Minggu, 1: Senin, ..., 6: Sabtu
      const distToMonday = currentDay === 0 ? 6 : currentDay - 1;

      const monday = new Date(now);
      monday.setDate(now.getDate() - distToMonday);
      monday.setHours(0, 0, 0, 0);

      const dayShortNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
      const dayFullNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const days = [];

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        d.setHours(0, 0, 0, 0);

        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        const dayOrders = validOrders.filter((ord) => {
          const ordDate = new Date(ord.created_at);
          return ordDate >= d && ordDate < nextD;
        });

        const revenue = dayOrders.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
        const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        days.push({
          key: d.toISOString().split('T')[0],
          label: dayShortNames[i], // Sen, Sel, Rab, Kam, Jum, Sab, Min
          fullDay: dayFullNames[i],
          subLabel: `${dayFullNames[i]}, ${dateStr}`,
          revenue,
          ordersCount: dayOrders.length,
          isToday: d.toDateString() === now.toDateString(),
          isFuture: d > now && d.toDateString() !== now.toDateString(),
        });
      }
      return days;
    }

    // 2. BULANAN: Tanggal 1 s/d Akhir Bulan (Urutan kalender resmi: Tgl 1 paling kiri s/d akhir bulan paling kanan)
    if (period === 'monthly') {
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const monthName = now.toLocaleDateString('id-ID', { month: 'short' });
      const fullMonthName = now.toLocaleDateString('id-ID', { month: 'long' });
      const days = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(currentYear, currentMonth, day, 0, 0, 0, 0);
        const nextD = new Date(currentYear, currentMonth, day + 1, 0, 0, 0, 0);

        const dayOrders = validOrders.filter((ord) => {
          const ordDate = new Date(ord.created_at);
          return ordDate >= d && ordDate < nextD;
        });

        const revenue = dayOrders.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

        days.push({
          key: `${currentYear}-${currentMonth + 1}-${day}`,
          label: String(day), // 1, 2, 3 ... 31
          fullDay: `${day} ${monthName}`,
          subLabel: `${day} ${fullMonthName} ${currentYear}`,
          revenue,
          ordersCount: dayOrders.length,
          isToday: day === now.getDate(),
          isFuture: day > now.getDate(),
        });
      }
      return days;
    }

    // 3. TAHUNAN: Januari s/d Desember (Urutan kalender: Jan paling kiri, Des paling kanan)
    const currentYear = now.getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const fullMonthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const months = [];

    for (let m = 0; m < 12; m++) {
      const monthOrders = validOrders.filter((ord) => {
        const ordDate = new Date(ord.created_at);
        return ordDate.getFullYear() === currentYear && ordDate.getMonth() === m;
      });

      const revenue = monthOrders.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);

      months.push({
        key: `${currentYear}-${m + 1}`,
        label: monthNames[m],
        fullDay: fullMonthNames[m],
        subLabel: `${fullMonthNames[m]} ${currentYear}`,
        revenue,
        ordersCount: monthOrders.length,
        isToday: m === now.getMonth(),
        isFuture: m > now.getMonth(),
      });
    }

    return months;
  }, [period, validOrders]);

  // Statistik Ringkasan Periode
  const summary = useMemo(() => {
    const totalRev = chartData.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrd = chartData.reduce((sum, item) => sum + item.ordersCount, 0);
    const aov = totalOrd > 0 ? Math.round(totalRev / totalOrd) : 0;

    let peak = chartData[0] || null;
    chartData.forEach((item) => {
      if (!peak || item.revenue > peak.revenue) {
        peak = item;
      }
    });

    return {
      totalRev,
      totalOrd,
      aov,
      peak,
    };
  }, [chartData]);

  // Cari nilai tertinggi untuk skala bar grafik
  const maxRevenue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.revenue), 0);
    return max > 0 ? max : 100000; // default baseline Rp 100.000 jika data kosong
  }, [chartData]);

  const now = new Date();
  const currentMonthName = now.toLocaleDateString('id-ID', { month: 'long' });
  const currentYear = now.getFullYear();

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
      {/* Header Grafik & Filter */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/50">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-neutral-900">Analisis Pendapatan & Grafik Omzet</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Visual Interaktif
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Pantau pertumbuhan omzet warkop per minggu (Senin-Minggu), per bulan (tgl 1-akhir), atau tahunan (Jan-Des)
          </p>
        </div>

        {/* Tab Pilihan Periode */}
        <div className="flex items-center gap-1.5 bg-neutral-200/70 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              period === 'weekly'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Minggu Ini (Sen - Min)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              period === 'monthly'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Bulan Ini ({currentMonthName})
          </button>
          <button
            type="button"
            onClick={() => setPeriod('yearly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              period === 'yearly'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Tahun Ini ({currentYear})
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 bg-white border-b border-neutral-100">
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100">
          <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Total Pemasukan
          </span>
          <div className="text-lg sm:text-xl font-extrabold text-amber-950 mt-1">
            {formatRupiah(summary.totalRev)}
          </div>
          <span className="text-[10px] text-amber-700/80 mt-0.5 block">
            Periode {period === 'weekly' ? 'minggu ini (Sen - Min)' : period === 'monthly' ? `bulan ${currentMonthName}` : `tahun ${currentYear}`}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
          <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5" /> Transaksi Selesai
          </span>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-950 mt-1">
            {summary.totalOrd} Pesanan
          </div>
          <span className="text-[10px] text-emerald-700/80 mt-0.5 block">
            {summary.totalRev > 0 ? 'Omzet terverifikasi masuk' : 'Belum ada transaksi'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100">
          <span className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Rata-rata / Nota (AOV)
          </span>
          <div className="text-lg sm:text-xl font-extrabold text-blue-950 mt-1">
            {formatRupiah(summary.aov)}
          </div>
          <span className="text-[10px] text-blue-700/80 mt-0.5 block">
            Rata-rata belanja per pesanan
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-100">
          <span className="text-[11px] font-semibold text-purple-800 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Puncak Teramai
          </span>
          <div className="text-sm sm:text-base font-extrabold text-purple-950 mt-1 truncate">
            {summary.peak && summary.peak.revenue > 0 ? summary.peak.subLabel : 'Belum Ada'}
          </div>
          <span className="text-[10px] text-purple-700/80 mt-0.5 block truncate">
            {summary.peak && summary.peak.revenue > 0
              ? `${formatRupiah(summary.peak.revenue)} (${summary.peak.ordersCount} pesanan)`
              : 'Belum ada data omzet'}
          </span>
        </div>
      </div>

      {/* Main Bar Chart Visualization */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-neutral-700">Grafik Batang Distribusi Omzet:</span>
            {hoveredIndex !== null && chartData[hoveredIndex] && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                {chartData[hoveredIndex].subLabel}: {formatRupiah(chartData[hoveredIndex].revenue)} ({chartData[hoveredIndex].ordersCount} pesanan)
              </span>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeOnlyCompleted}
              onChange={(e) => setIncludeOnlyCompleted(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px] font-medium">Hanya pesanan lunas/selesai</span>
          </label>
        </div>

        {/* Visual Chart Container */}
        <div className="relative pt-6 pb-2">
          {/* Garis Horizontal Bantuan (Y-Axis Guide) */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-6">
            <div className="border-b border-dashed border-neutral-200 flex justify-between text-[10px] text-neutral-400">
              <span>{formatShortRupiah(maxRevenue)}</span>
              <span>100%</span>
            </div>
            <div className="border-b border-dashed border-neutral-200 flex justify-between text-[10px] text-neutral-400">
              <span>{formatShortRupiah(maxRevenue * 0.5)}</span>
              <span>50%</span>
            </div>
            <div className="border-b border-neutral-300 flex justify-between text-[10px] text-neutral-400">
              <span>Rp 0</span>
              <span>0%</span>
            </div>
          </div>

          {/* Batang-batang grafik (Bars) */}
          <div
            className={`relative flex items-end h-48 sm:h-56 z-10 pt-4 px-1 sm:px-2 ${
              period === 'monthly' ? 'gap-[2px] sm:gap-1' : 'gap-1.5 sm:gap-3'
            }`}
          >
            {chartData.map((item, idx) => {
              const heightPercent = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
              const isHovered = hoveredIndex === idx;
              const isPeak = summary.peak && summary.peak.key === item.key && item.revenue > 0;

              return (
                <div
                  key={item.key}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Floating Tooltip Hover */}
                  {isHovered && (
                    <div className="absolute -top-12 z-20 bg-neutral-900 text-white text-[11px] py-1 px-2.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
                      <span className="font-bold">{formatRupiah(item.revenue)}</span>
                      <span className="text-[10px] text-neutral-400">
                        {item.ordersCount} pesanan • {item.subLabel}
                      </span>
                      <div className="w-2 h-2 bg-neutral-900 rotate-45 -mb-1 mt-0.5" />
                    </div>
                  )}

                  {/* Nilai di atas bar untuk periode mingguan */}
                  {period === 'weekly' && item.revenue > 0 && (
                    <span
                      className={`text-[9px] sm:text-[10px] font-bold mb-1 transition-all ${
                        isHovered || isPeak ? 'text-amber-700 scale-105' : 'text-neutral-500'
                      }`}
                    >
                      {formatShortRupiah(item.revenue)}
                    </span>
                  )}

                  {/* Visual Bar */}
                  <div className="w-full flex justify-center items-end h-full">
                    <div
                      style={{ height: `${Math.max(heightPercent, item.revenue > 0 ? 6 : 2)}%` }}
                      className={`w-full max-w-[42px] rounded-t-md sm:rounded-t-lg transition-all duration-300 relative ${
                        isPeak
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-md shadow-amber-500/20'
                          : item.revenue > 0
                          ? isHovered
                            ? 'bg-amber-600'
                            : 'bg-gradient-to-t from-neutral-700 to-neutral-500'
                          : 'bg-neutral-200/80'
                      } ${
                        item.isToday
                          ? 'ring-2 ring-emerald-500 ring-offset-1'
                          : ''
                      }`}
                    >
                      {/* Highlight Peak Badge */}
                      {isPeak && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white rounded-full p-0.5 shadow-xs">
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Label Bawah (X-Axis) */}
                  <div className="mt-2 text-center w-full">
                    <span
                      className={`block text-[10px] sm:text-[11px] font-bold truncate ${
                        item.isToday
                          ? 'text-emerald-700 font-black underline underline-offset-2'
                          : isHovered
                          ? 'text-amber-800'
                          : 'text-neutral-600'
                      }`}
                    >
                      {period === 'monthly'
                        ? (item.label === '1' || Number(item.label) % 5 === 0 || item.isToday || item.label === String(chartData.length)
                            ? item.label
                            : '')
                        : item.label}
                    </span>
                    {period === 'weekly' && (
                      <span className="text-[9px] text-neutral-400 hidden sm:block">
                        {item.subLabel.split(', ')[1]?.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info & Insight */}
      <div className="p-3 sm:p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 font-semibold text-neutral-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-amber-600 to-amber-400" />
            Omzet Tertinggi
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-neutral-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-neutral-700 to-neutral-500" />
            Ada Transaksi
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Hari / Bulan Ini
          </span>
        </div>

        <div className="text-[11px] text-neutral-400">
          💡 Arahkan kursor / sentuh batang untuk melihat rincian omzet & jumlah pesanan
        </div>
      </div>
    </div>
  );
};