// @ts-nocheck
import { formatCairoTime, getNextScheduledSyncCountdown } from "../shared/time";
import React, { useEffect, useState } from "react";
import { 
  RefreshCw, 
  Clock, 
  HelpCircle, 
  Layers2, 
  Bell, 
  Search,
  Filter,
  X,
  Zap
} from "lucide-react";
import { PlatformConnection } from "../types";

interface TopHeaderProps {
  activeTab: string;
  selectedPlatform: string;
  setSelectedPlatform: (plat: string) => void;
  syncing: boolean;
  syncStatus: string;
  syncStatusDetails: string;
  onSyncNow: (force?: boolean) => void;
  cairoTime: Date;
  schedulerEnabled: boolean;
  schedulerInterval: number;
  onSchedulerChange: (enabled: boolean, interval: number) => void;
  forceSyncRequired?: boolean;
  syncProgress?: {
    syncing: boolean;
    processedCount: number;
    totalProducts: number;
    statusText: string;
    percentage: number;
  } | null;
  syncError?: { code: string; platform: string; } | null;
  onClearSyncError?: () => void;
  platformConnections?: PlatformConnection[];
  nextScheduledSyncAt?: string | null;
}

export default function TopHeader({
  activeTab,
  selectedPlatform,
  setSelectedPlatform,
  syncing,
  syncStatus,
  syncStatusDetails,
  onSyncNow,
  cairoTime,
  schedulerEnabled,
  schedulerInterval,
  onSchedulerChange,
  forceSyncRequired = false,
  syncProgress = null,
  syncError = null,
  onClearSyncError,
  platformConnections = [],
  nextScheduledSyncAt = null
}: TopHeaderProps) {
  
  const activeConn = platformConnections.find(c => c.isActive && c.monitoring_enabled);
  const targetNextSyncIso = nextScheduledSyncAt || activeConn?.next_scheduled_sync_at;
  const { countdownStr, targetCairoTimeStr } = getNextScheduledSyncCountdown(
    cairoTime,
    schedulerEnabled,
    schedulerInterval,
    targetNextSyncIso
  );

  const getTabDetails = () => {
    switch (activeTab) {
      case "home":
        return {
          title: "لوحة المراقبة الشاملة",
          desc: "رصد فوري لمؤشرات سحب مخزون السلع المتاحة بالمنصات المصرية وتحديد فرص التسويق."
        };
      case "hourly_analytics":
        return {
          title: "تحليلات الساعات ومعدلات التدفق للمخازن",
          desc: "تحليل سحب المخزون، ونسب اكتمال البيانات وجودة الرصد لكل ساعة بالتوقيت المحلي لجمهورية مصر العربية (Cairo Time)."
        };
      case "products":
        return {
          title: "مستكشف الكتالوج العام",
          desc: "دليل المنتجات الكامل، مرشحات الحالات المتقدمة، وبحث تفصيلي بالـ SKU والكميات."
        };
      case "highest_decrease":
        return {
          title: "قائمة المنتجات الأكثر نقصاً",
          desc: "السلع التي تسجل أعلى انخفاض كمي في المخازن خلال الـ 24 ساعة الماضية للتركيز عليها."
        };
      case "trending":
        return {
          title: "المنتجات المتسارعة بالطلب الآن",
          desc: "تحليل تسارعي يعتمد على رصد معدل سحب قطع المخازن بالدقائق الماضية وتصاعد الطلب."
        };
      case "categories":
        return {
          title: "تحليلات تصنيفات السوق",
          desc: "رصد قطاعات المنتجات النشطة بالطلب، الحصة الكلية، ومعدلات السحوبات النسبية."
        };
      case "restock":
        return {
          title: "تحليلات إعادة التخزين والتدفق",
          desc: "جدول بالمنتجات والكميات المضافة حديثاً للمخازن ومطابقة الشحنات بمزودي صفقة."
        };
      case "compare":
        return {
          title: "مقارنة المنصات والقنوات",
          desc: "مؤشرات مقارنة السحوبات والتمثيل الكلي لكتالوج صفقة مقابل تاجر وقنوات الربط."
        };
      case "alerts":
        return {
          title: "سجل التنبيهات والتحذيرات",
          desc: "إشعارات نفاذ السلع السريعة، الحركات غير المعتادة بالمخزن، وحالات فشل اتصال الـ API."
        };
      case "connect":
        return {
          title: "بوابات ومفاتيح الربط (API)",
          desc: "تهيئة مفاتيح الربط وتراخيص الاتصال الفعلي بالمنصات ومطابقة مسار الرصد السحابي."
        };
      case "history":
        return {
          title: "سجل العمليات والمزامنة",
          desc: "أرشيف تقني للمهام التلقائية واليدوية، والكميات والأخطاء واللقطات التي رُصدت."
        };
      case "settings":
        return {
          title: "لوحة التحكم وإعدادات الرادار",
          desc: "ضبط الفترات الزمنية للرصد والحدود الإحصائية وإعادة صيانة قواعد البيانات."
        };
      default:
        return {
          title: "ستوك رادار",
          desc: "ذكاء رصد المخزون وحماية الحملات الإعلانية."
        };
    }
  };

  const { title, desc } = getTabDetails();

  const formatCairoDate = (date: Date) => {
    return date.toLocaleDateString("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Africa/Cairo"
    });
  };

  return (
    <header className="sticky top-0 z-20 h-20 bg-[#07111F]/80 backdrop-blur-xl border-b border-[#20324A] flex items-center justify-between px-6 transition-all duration-300">
      {/* Tab Title and Description */}
      <div className="text-right max-w-lg md:max-w-xl">
        <h1 className="text-base font-extrabold text-[#F4F7FB] font-display">{title}</h1>
        <p className="text-[11px] text-[#9FB0C5] mt-0.5 line-clamp-1">{desc}</p>
      </div>

      {/* Action Controls & Info Widgets */}
      <div className="flex items-center gap-2 md:gap-3.5 overflow-x-auto no-scrollbar max-w-full py-1">
        
        {/* Dynamic Cairo Clock Widget */}
        <div 
          onClick={() => {
            const currentOffset = typeof window !== "undefined" ? (parseInt(localStorage.getItem("cairo_clock_offset") || "0", 10)) : 0;
            // Cycle: 0 -> -1 -> -2 -> 1 -> 0
            const nextOffset = currentOffset === 0 ? -1 : currentOffset === -1 ? -2 : currentOffset === -2 ? 1 : 0;
            localStorage.setItem("cairo_clock_offset", String(nextOffset));
            window.location.reload();
          }}
          title="انقر لتعديل فرق توقيت القاهرة (تقليل ساعة إذا كانت الساعة متقدمة)"
          className="hidden sm:flex items-center gap-2 bg-[#0D1B2D] border border-[#20324A] px-3 py-1.5 rounded-xl text-right select-none h-11 cursor-pointer hover:border-[#2F80FF] transition-colors group shrink-0"
        >
          <Clock className="w-4 h-4 text-[#2F80FF] group-hover:scale-110 transition-transform" />
          <div>
            <span className="text-[10px] text-[#2F80FF] font-bold block leading-none flex items-center justify-end gap-1">
              توقيت القاهرة 🇪🇬
              {typeof window !== "undefined" && parseInt(localStorage.getItem("cairo_clock_offset") || "0", 10) !== 0 && (
                <span className="text-[9px] bg-[#2F80FF]/20 text-[#2F80FF] px-1 rounded">
                  {localStorage.getItem("cairo_clock_offset")} س
                </span>
              )}
            </span>
            <span className="text-[11px] text-[#F4F7FB] font-mono font-bold mt-1 block leading-none">
              {formatCairoTime(cairoTime)}
            </span>
          </div>
        </div>

        {/* Next Scheduled Sync Countdown Widget (Cairo Clock Relative) */}
        <div className="hidden md:flex items-center gap-2 bg-[#0D1B2D] border border-[#20324A] px-3 py-1.5 rounded-xl text-right select-none h-11 shrink-0">
          <div className="relative flex items-center justify-center">
            <Clock className={`w-4 h-4 ${syncing ? "text-[#2F80FF] animate-spin" : "text-[#24C78E]"}`} />
            {schedulerEnabled && !syncing && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#24C78E] rounded-full animate-ping" />
            )}
          </div>
          <div className="flex flex-col items-end justify-center">
            <span className="text-[9px] text-[#9FB0C5] font-bold leading-none flex items-center gap-1">
              <span>المزامنة القادمة</span>
              {schedulerEnabled && !syncing && (
                <span className="text-[8px] text-[#24C78E] font-mono">({targetCairoTimeStr})</span>
              )}
            </span>
            <span className={`text-[11px] font-mono font-black mt-1 leading-none tracking-wider ${syncing ? "text-[#2F80FF] animate-pulse" : "text-[#24C78E]"}`}>
              {syncing ? "جارٍ الرصد المباشر ⚡" : (schedulerEnabled ? countdownStr : "معطلة")}
            </span>
          </div>
        </div>

        {/* Global Platform Dropdown filter */}
        <div className="flex items-center gap-2 bg-[#0D1B2D] border border-[#20324A] rounded-xl px-2.5 h-11">
          <Filter className="w-3.5 h-3.5 text-[#9FB0C5]" />
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="bg-transparent border-none text-xs font-bold text-[#F4F7FB] outline-none pr-1 pl-4 cursor-pointer"
          >
            <option value="all" className="bg-[#0D1B2D] text-white">جميع المنصات</option>
            <option value="safka" className="bg-[#0D1B2D] text-white">منصة صفقة Safka</option>
          </select>
        </div>

        {/* Sync Settings Toggle and Frequency */}
        <div className="flex items-center gap-2 bg-[#0D1B2D] border border-[#20324A] rounded-xl px-2.5 h-11">
          <label className="flex items-center gap-2 cursor-pointer">
             <input type="checkbox" checked={schedulerEnabled} onChange={(e) => onSchedulerChange(e.target.checked, schedulerInterval)} className="form-checkbox h-4 w-4 text-[#2F80FF]" />
             <span className="text-xs text-[#F4F7FB] font-bold">تزامن تلقائي</span>
          </label>
          <select
            value={schedulerInterval}
            onChange={(e) => onSchedulerChange(schedulerEnabled, parseInt(e.target.value))}
            className="bg-transparent border-none text-xs font-bold text-[#F4F7FB] outline-none pr-1 pl-4 cursor-pointer"
          >
            <option value="1" className="bg-[#0D1B2D] text-white">دقيقة بدقيقة (تحديث فوري)</option>
            <option value="5" className="bg-[#0D1B2D] text-white">كل 5 دقائق</option>
            <option value="10" className="bg-[#0D1B2D] text-white">كل 10 دقائق</option>
            <option value="20" className="bg-[#0D1B2D] text-white">كل ثلث ساعة (3 مرات/ساعة)</option>
            <option value="60" className="bg-[#0D1B2D] text-white">كل ساعة فقط</option>
          </select>
        </div>

        {/* Sync Status Indicator and Progress Bar / Error Area */}
        {syncError ? (
          <div className="hidden md:flex items-center gap-2.5 bg-[#251010] border border-[#521C1C] px-3 py-1 rounded-xl h-11 text-right">
            <div className="flex flex-col items-end justify-center">
              <span className="text-[9px] text-red-400 font-black flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                فشلت المزامنة ⚠️
              </span>
              <span className="text-[8px] text-[#FFC1C1] font-mono leading-none mt-0.5">
                {syncError.code}
              </span>
            </div>
            
            <button
              onClick={() => onSyncNow(false)}
              className="bg-[#D32F2F] hover:bg-[#E53935] text-white font-black text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all duration-150 active:scale-95 cursor-pointer shadow-md shadow-red-900/25"
              title={`إعادة محاولة المزامنة لمنصة ${syncError.platform}`}
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>إعادة</span>
            </button>

            {onClearSyncError && (
              <button 
                onClick={onClearSyncError}
                className="text-red-400 hover:text-white transition duration-150 p-0.5 rounded cursor-pointer"
                title="تجاهل الخطأ"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-col items-end justify-center bg-[#0D1B2D] border border-[#20324A] px-3.5 py-1.5 rounded-xl h-11 min-w-[170px] max-w-[230px] text-right">
            <div className="flex items-center justify-between w-full gap-2">
              {syncing && syncProgress && syncProgress.totalProducts > 0 ? (
                <span className="text-[8px] text-[#9FB0C5] font-mono leading-none">
                  {syncProgress.processedCount}/{syncProgress.totalProducts} ({syncProgress.percentage}%)
                </span>
              ) : (
                <span className="text-[8px] text-[#9FB0C5] font-mono leading-none">
                  {syncing ? "استرداد الكتالوج..." : "مستقر ومزامن"}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-black flex items-center gap-1 ${syncing ? "text-[#2F80FF]" : "text-emerald-400"}`}>
                  {syncing ? (syncProgress?.percentage !== undefined ? `معالجة ${syncProgress.percentage}%` : "جاري المزامنة...") : "جاهز"}
                </span>
                <span className={`w-2 h-2 rounded-full ${syncing ? "bg-[#2F80FF] animate-ping" : "bg-emerald-400"}`}></span>
              </div>
            </div>
            
            {/* Real-time Progress Bar with Animated Gradient Pulse */}
            <div className="w-full bg-[#12233A] rounded-full h-2 mt-1 overflow-hidden relative border border-[#20324A]/60 shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
                  syncing 
                    ? "bg-gradient-to-r from-[#2F80FF] via-[#00DF89] to-[#00F0FF] animate-gradient-pulse shadow-[0_0_10px_rgba(0,223,137,0.5)]" 
                    : "bg-emerald-400"
                }`}
                style={{ width: `${syncing ? Math.max(10, syncProgress?.percentage || 15) : 100}%` }}
              >
                {/* Shimmer light streak moving across */}
                {syncing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sync Now Action Button */}
        <div className="flex items-center gap-2">
          {forceSyncRequired && !syncing && (
            <button
              onClick={() => onSyncNow(true)}
              className="h-11 px-4 rounded-xl flex items-center gap-2 text-xs font-black cursor-pointer transition duration-200 bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/15 animate-pulse"
              title="إجبار التحديث وتجاوز القفول العالقة فوراً"
            >
              <RefreshCw className="w-4 h-4 text-white" />
              <span>فرض التحديث بالقوة ⚠️</span>
            </button>
          )}

          <button
            onClick={() => onSyncNow(false)}
            disabled={syncing}
            className={`h-11 px-4 rounded-xl flex items-center gap-2 text-xs font-black cursor-pointer transition duration-200 ${
              syncing 
                ? "bg-[#12233A] text-[#9FB0C5] border border-[#20324A] cursor-not-allowed" 
                : "bg-[#2F80FF] text-white hover:bg-[#4A92FF] shadow-md shadow-[#2F80FF]/15 active:scale-95"
            }`}
            title={syncStatusDetails || "بدء فحص المخازن ومطابقة التغيرات الفورية"}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-[#9FB0C5]" : "text-white"}`} />
            <span>
              {syncing ? syncStatus || "جارٍ التحديث..." : "مزامنة الآن"}
            </span>
          </button>
        </div>

      </div>
    </header>
  );
}
