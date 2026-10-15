import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { Order } from '../types';

interface RevenueChartProps {
  orders: Order[];
}

type PeriodType = '7days' | '30days' | 'monthly';

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
  const [period, setPeriod] = useState<PeriodType>('7days');
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

    if (period === '7days') {
      const days = [];
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        const dayOrders = validOrders.filter((ord) => {
          const ordDate = new Date(ord.created_at);
          return ordDate >= d && ordDate < nextD;
        });

        const revenue = dayOrders.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
        const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        const dayName = dayNames[d.getDay()];

        days.push({
          key: d.toISOString().split('T')[0],
          label: dayName,
          subLabel: dateStr,
          revenue,
          ordersCount: dayOrders.length,
          isToday: i === 0,
        });
      }
      return days;
    }

    if (period === '30days') {
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        const dayOrders = validOrders.filter((ord) => {
          const ordDate = new Date(ord.created_at);
          return ordDate >= d && ordDate < nextD;
        });

        const revenue = dayOrders.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
        const dayNum = d.getDate();
        const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        days.push({
          key: d.toISOString().split('T')[0],
          label: String(dayNum),
          subLabel: dateStr,
          revenue,
          ordersCount: dayOrders.length,
          isToday: i === 0,
        });
      }
      return days;
    }

    // Bulanan (12 Bulan dalam 1 tahun berjalan)
    const currentYear = now.getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
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
        subLabel: `${monthNames[m]} ${currentYear}`,
        revenue,
        ordersCount: monthOrders.length,
        isToday: m === now.getMonth(),
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

  // Nilai tertinggi untuk skala bar grafik
  const maxRevenue = useMemo(() => {
    const max = Math.max(...chartData.map((d) => d.revenue), 0);
    return max > 0 ? max : 100000;
  }, [chartData]);

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
            Pantau pertumbuhan omzet warkop per hari, minggu, atau akumulasi bulanan
          </p>
        </div>

        {/* Tab Pilihan Periode */}
        <div className="flex items-center gap-1.5 bg-neutral-200/70 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setPeriod('7days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              period === '7days'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            7 Hari
          </button>
          <button
            onClick={() => setPeriod('30days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              period === '30days'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            30 Hari
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              period === 'monthly'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Bulanan (1 Tahun)
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
            Periode {period === '7days' ? '7 hari terakhir' : period === '30days' ? '30 hari terakhir' : 'tahun ini'}
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
            <Sparkles className="w-3.5 h-3.5" /> Hari / Bulan Teramai
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-700">Grafik Batang Distribusi Omzet</span>
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
              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
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
            className={`relative flex items-end h-48 sm:h-56 gap-1 sm:gap-2 z-10 pt-4 px-2 ${
              period === '30days' ? 'gap-0.5 sm:gap-1' : ''
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
                      <span className="text-[10px] text-neutral-400">{item.ordersCount} transaksi • {item.subLabel}</span>
                      <div className="w-2 h-2 bg-neutral-900 rotate-45 -mb-1 mt-0.5" />
                    </div>
                  )}

                  {/* Nilai di atas bar untuk 7 hari */}
                  {period === '7days' && item.revenue > 0 && (
                    <span
                      className={`text-[10px] font-bold mb-1 transition-all ${
                        isHovered || isPeak ? 'text-amber-700 scale-105' : 'text-neutral-400'
                      }`}
                    >
                      {formatShortRupiah(item.revenue)}
                    </span>
                  )}

                  {/* Visual Bar */}
                  <div className="w-full flex justify-center items-end h-full">
                    <div
                      style={{ height: `${Math.max(heightPercent, 3)}%` }}
                      className={`w-full max-w-[38px] rounded-t-lg transition-all duration-300 relative ${
                        isPeak
                          ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-md shadow-amber-500/20'
                          : item.revenue > 0
                          ? isHovered
                            ? 'bg-amber-600'
                            : 'bg-gradient-to-t from-neutral-700 to-neutral-500'
                          : 'bg-neutral-200'
                      } ${item.isToday ? 'ring-2 ring-emerald-500/80 ring-offset-1' : ''}`}
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
                      className={`block text-[11px] font-bold truncate ${
                        item.isToday
                          ? 'text-emerald-700 font-extrabold'
                          : isHovered
                          ? 'text-amber-800'
                          : 'text-neutral-600'
                      }`}
                    >
                      {item.label}
                    </span>
                    {period === '7days' && (
                      <span className="text-[9px] text-neutral-400 hidden sm:block">
                        {item.subLabel.split(' ')[0]}
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
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-neutral-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-amber-600 to-amber-400" />
            Omzet Tertinggi
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-neutral-700">
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-neutral-700 to-neutral-500" />
            Normal
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Hari Ini
          </span>
        </div>

        <div className="text-[11px] text-neutral-400">
          💡 Arahkan kursor / sentuh batang untuk melihat rincian per tanggal
        </div>
      </div>
    </div>
  );
};