// @ts-nocheck
import React, { useState, useEffect } from "react";
import { 
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Area
} from "recharts";
import { 
  Info, 
  AlertCircle, 
  Database, 
  TrendingDown, 
  Activity, 
  ArrowDownLeft, 
  ArrowUpRight,
  Sparkles,
  CircleHelp,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ArrowLeftRight,
  CheckSquare,
  RefreshCw,
  TrendingUp,
  Trash2,
  Filter,
  Grid,
  List,
  Eye,
  Shield,
  Lock,
  X,
  TrendingUp as TrendingUpIcon
} from "lucide-react";
import { Product, SyncRun, ChartTimelinePoint, OverviewMetrics, WeeklyDayRecord } from "../types";
import { getCairoTodayStr, getCairoYesterdayStr, addDaysToDateStr } from "../shared/time";
import { DateRangePicker } from "./DateRangePicker";
import { formatCairoTime } from "../shared/time";
import { safeFetchJson } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";


const VolatilityTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#12233A] border border-[#20324A] p-3 rounded-xl text-[11px] text-[#F4F7FB] shadow-xl text-right min-w-[150px]">
        <div className="font-bold border-b border-[#20324A]/50 pb-1.5 text-[#3B82F6] flex items-center gap-1.5 justify-end">
          <span>{label}:00</span>
        </div>
        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between items-center gap-4">
            <span className="text-[#9FB0C5]">القطع المسحوبة:</span>
            <strong className="text-[#3B82F6] font-mono">{data.displayWithdrawals}</strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const formatHourLocal = (hour: number | null) => {
  if (hour === null) return "غير محدد";
  return `${hour.toString().padStart(2, "0")}:00`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#12233A] border border-[#20324A] p-3.5 rounded-2xl text-[11px] text-[#F4F7FB] shadow-2xl text-right min-w-[190px]">
        <div className="font-bold border-b border-[#20324A]/50 pb-2 text-[#2F80FF] flex items-center gap-1.5 justify-end">
          <Clock className="w-3.5 h-3.5" />
          <span>دورة رصد: {label}</span>
        </div>
        <div className="space-y-2 mt-2.5">
          <div className="flex justify-between items-center gap-4">
            <span className="text-[#9FB0C5]">إجمالي السحب:</span>
            <strong className="text-[#24C78E] font-mono">{data.quantityDecrease} قطعة</strong>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-[#9FB0C5]">شحن وتخزين:</span>
            <strong className="text-[#F5A524] font-mono">+{data.restockAmount} قطعة</strong>
          </div>
          {data.startedAt && (
            <div className="text-[9px] text-[#9FB0C5]/60 pt-1.5 border-t border-[#20324A]/30 mt-2 text-left font-mono">
              {new Date(data.startedAt).toLocaleString("ar-EG")}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

interface DashboardOverviewProps {
  products: Product[];
  syncRuns: SyncRun[];
  chartData: ChartTimelinePoint[];
  weeklyHistory?: WeeklyDayRecord[];
  onProductClick: (p: Product) => void;
  metrics: OverviewMetrics | null;
}

export default function DashboardOverview({
  products,
  syncRuns,
  chartData,
  weeklyHistory = [],
  onProductClick,
  metrics
}: DashboardOverviewProps) {
  
  const [selectedChartPoint, setSelectedChartPoint] = useState<ChartTimelinePoint | null>(null);
  const isWithdrawalsDisabled = import.meta.env.VITE_DISABLE_WITHDRAWAL_EVENTS === "true";

  // Hourly withdrawals volatility state
  const [selectedHourlyDateStart, setSelectedHourlyDateStart] = useState<string>(getCairoTodayStr());
  const [selectedHourlyDateEnd, setSelectedHourlyDateEnd] = useState<string>(getCairoTodayStr());
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loadingHourly, setLoadingHourly] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const fetchHourly = async () => {
      setLoadingHourly(true);
      try {
        const res = await safeFetchJson<any>(`/api/analytics/hourly-withdrawals?startDate=${selectedHourlyDateStart}&endDate=${selectedHourlyDateEnd}`);
        if (res.success && active) {
          setHourlyData(res.hours || []);
        }
      } catch (err) {
        console.error("Failed to fetch hourly withdrawals:", err);
      } finally {
        if (active) setLoadingHourly(false);
      }
    };
    fetchHourly();
    return () => {
      active = false;
    };
  }, [selectedHourlyDateStart, selectedHourlyDateEnd]);

  // Hourly volatility analytics calculations
  const hourlyStats = React.useMemo(() => {
    if (!hourlyData || hourlyData.length === 0) {
      return { total: 0, average: 0, peakHour: null, peakVal: 0, volatility: 0, volatilityText: "مستقر" };
    }
    
    const completeHours = hourlyData.filter(h => h.status === "COMPLETE" || h.status === "PARTIAL" || h.status === "RUNNING");
    const values = completeHours.map(h => h.totalWithdrawals || 0);
    const total = values.reduce((sum, v) => sum + v, 0);
    const n = values.length || 1;
    const average = total / n;
    
    let peakHour = null;
    let peakVal = -1;
    hourlyData.forEach(h => {
      const val = h.totalWithdrawals || 0;
      if (val > peakVal) {
        peakVal = val;
        peakHour = h.hour;
      }
    });

    const variance = values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    let volatilityText = "مستقر منخفض";
    if (stdDev > 25) {
      volatilityText = "تقلبات شديدة الخطورة 🚨";
    } else if (stdDev > 10) {
      volatilityText = "تقلبات متوسطة ⚡";
    } else if (stdDev > 2) {
      volatilityText = "تقلبات طفيفة طبيعية";
    }
    
    return {
      total,
      average: Math.round(average * 10) / 10,
      peakHour,
      peakVal: peakVal === -1 ? 0 : peakVal,
      volatility: Math.round(stdDev * 10) / 10,
      volatilityText
    };
  }, [hourlyData]);
  
  // Real-time ticking clock for exact minute-by-minute calculations
  const [nowMs, setNowMs] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTimeArabic = (targetIsoString: string | null | undefined) => {
    if (!targetIsoString) return "غير متوفر";
    try {
      const diffMs = nowMs - new Date(targetIsoString).getTime();
      if (diffMs < 0) return "الآن";
      
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) {
        return `منذ ${diffSec} ثانية`;
      }
      
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) {
        if (diffMin === 1) return "منذ دقيقة واحدة";
        if (diffMin === 2) return "منذ دقيقتين";
        if (diffMin >= 3 && diffMin <= 10) return `منذ ${diffMin} دقائق`;
        return `منذ ${diffMin} دقيقة`;
      }
      
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) {
        if (diffHrs === 1) return "منذ ساعة واحدة";
        if (diffHrs === 2) return "منذ ساعتين";
        if (diffHrs >= 3 && diffHrs <= 10) return `منذ ${diffHrs} ساعات`;
        return `منذ ${diffHrs} ساعة`;
      }
      
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays === 1) return "منذ يوم واحد";
      if (diffDays === 2) return "منذ يومين";
      return `منذ ${diffDays} يوم`;
    } catch {
      return "غير معروف";
    }
  };

  const getExactTimeDifferenceArabic = (timeA: string | null | undefined, timeB: string | null | undefined) => {
    if (!timeA || !timeB) return null;
    try {
      const dateA = new Date(timeA);
      const dateB = new Date(timeB);
      const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) {
        return `${diffSec} ثانية`;
      }
      const diffMin = Math.floor(diffSec / 60);
      const remainingSec = diffSec % 60;
      
      let result = "";
      if (diffMin === 1) result = "دقيقة واحدة";
      else if (diffMin === 2) result = "دقيقتين";
      else if (diffMin >= 3 && diffMin <= 10) result = `${diffMin} دقائق`;
      else result = `${diffMin} دقيقة`;
      
      if (remainingSec > 0) {
        result += ` و ${remainingSec} ثانية`;
      }
      return result;
    } catch {
      return null;
    }
  };

  // Accuracy check states
  interface AccuracyCheckAnomaly {
    id: string;
    productId: string;
    productName: string;
    platform: string;
    previousQuantity: number;
    currentQuantity: number;
    quantityDecrease: number;
    restockAmount: number;
    checkedAt: string;
    anomalyReason: string;
  }

  interface AccuracyCheckResult {
    success: boolean;
    isInstantaneous: boolean;
    statusText: string;
    reason: string;
    lastSyncTime: string | null;
    lastChangeTime: string | null;
    anomalies?: AccuracyCheckAnomaly[];
    latestRunDetails: {
      id: string;
      productsReceived: number;
      productsUpdated: number;
      snapshotsCreated: number;
    } | null;
    latestChangeDetails: {
      productId: string;
      quantityDecrease: number;
      restockAmount: number;
    } | null;
  }

  const [accuracy, setAccuracy] = useState<AccuracyCheckResult | null>(null);
  const [checkingAccuracy, setCheckingAccuracy] = useState(false);
  const [syncingAccuracy, setSyncingAccuracy] = useState(false);
  const [accuracyError, setAccuracyError] = useState<string | null>(null);

  // Security center interactive states
  const [acknowledgedAnomalyIds, setAcknowledgedAnomalyIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("acknowledged_anomalies");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [anomalyViewMode, setAnomalyViewMode] = useState<"table" | "grid">("grid");
  const [anomalyFilterPlatform, setAnomalyFilterPlatform] = useState<string>("all");
  const [anomalyFilterSeverity, setAnomalyFilterSeverity] = useState<string>("all");
  const [expandedAnomalyId, setExpandedAnomalyId] = useState<string | null>(null);
  const [showAcknowledged, setShowAcknowledged] = useState<boolean>(true);
  const [isAnomaliesCollapsed, setIsAnomaliesCollapsed] = useState<boolean>(true);

  const toggleAcknowledgeAnomaly = (id: string) => {
    const isAck = acknowledgedAnomalyIds.includes(id);
    let updated: string[];
    if (isAck) {
      updated = acknowledgedAnomalyIds.filter(x => x !== id);
    } else {
      updated = [...acknowledgedAnomalyIds, id];
    }
    setAcknowledgedAnomalyIds(updated);
    localStorage.setItem("acknowledged_anomalies", JSON.stringify(updated));
  };

  const clearAllAcknowledged = () => {
    setAcknowledgedAnomalyIds([]);
    localStorage.removeItem("acknowledged_anomalies");
  };

  const performAccuracyCheck = async () => {
    setCheckingAccuracy(true);
    setAccuracyError(null);
    try {
      const data = await safeFetchJson<AccuracyCheckResult>("/api/analytics/accuracy-check");
      if (data.success) {
        setAccuracy(data);
      } else {
        setAccuracyError("فشل تحميل بيانات فحص المطابقة");
      }
    } catch (err: any) {
      setAccuracyError("حدث خطأ أثناء الاتصال بالخادم الرئيسي للمطابقة");
    } finally {
      setCheckingAccuracy(false);
    }
  };

  useEffect(() => {
    performAccuracyCheck();
  }, []);

  const handleAccuracySync = async () => {
    setSyncingAccuracy(true);
    setAccuracyError(null);
    try {
      const syncRes = await safeFetchJson<any>("/api/platforms/safka/sync", { method: "POST" });
      if (syncRes.success) {
        await performAccuracyCheck();
      } else {
        setAccuracyError("حدث تداخل أو فشل في مزامنة القناة. يرجى فرض التحديث.");
      }
    } catch (err) {
      setAccuracyError("فشل ربط الاتصال بقنوات المزامنة التلقائية");
    } finally {
      setSyncingAccuracy(false);
    }
  };

  const formatTimeArabic = (isoString: string | undefined) => {
    if (!isoString) return "--";
    return formatCairoTime(isoString);
  };

  const getDayArabic = (isoString: string | undefined) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // Get maximum value (decrease or restock) to scale SVG columns nicely
  const getMaxDecrease = () => {
    if (chartData.length === 0) return 100;
    const max = Math.max(
      ...chartData.map(p => Math.max(p.quantityDecrease || 0, p.restockAmount || 0)),
      10
    );
    return max;
  };

  // Calculate risk values for low stock items
  const lowStockItems = products
    .filter(p => p.currentQuantity !== null && p.currentQuantity <= 20 && p.currentQuantity > 0)
    .slice(0, 5);

  const getWeeklyPredictiveRisk = (p: Product) => {
    const currentQty = p.currentQuantity || 0;
    if (currentQty <= 0) {
      return {
        hoursLeft: 0,
        predicted24hDemand: 0,
        riskLevel: "نفد بالكامل ❌",
        badgeStyle: "bg-[#F05252]/10 text-[#F05252] border border-[#F05252]/20",
        confidence: "مؤكد"
      };
    }

    // 1. Calculate historical average daily decrease across weeklyHistory
    const totalWeeklyDecrease = weeklyHistory.reduce((sum, h) => sum + h.quantityDecrease, 0);
    const avgDailyDecrease = totalWeeklyDecrease / (weeklyHistory.length || 7);

    // 2. Identify day of week factors for today and tomorrow
    const arabicDaysMap = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const todayNum = new Date().getDay();
    const tomorrowNum = (todayNum + 1) % 7;
    
    const todayName = arabicDaysMap[todayNum];
    const tomorrowName = arabicDaysMap[tomorrowNum];

    const todayRecord = weeklyHistory.find(h => h.dayName === todayName);
    const tomorrowRecord = weeklyHistory.find(h => h.dayName === tomorrowName);

    // Use historical day record to get weight compared to weekly average
    const todayWeight = avgDailyDecrease > 0 && todayRecord 
      ? (todayRecord.quantityDecrease / avgDailyDecrease) 
      : 1.0;
    const tomorrowWeight = avgDailyDecrease > 0 && tomorrowRecord 
      ? (tomorrowRecord.quantityDecrease / avgDailyDecrease) 
      : 1.0;

    // Next 24 hours will experience a blend of today's and tomorrow's demand weight
    const next24hTrendWeight = (todayWeight + tomorrowWeight) / 2;

    // 3. Base daily demand for this specific product
    const productTodayDecrease = p.dailyQuantityDecrease || p.quantityDecrease || 0;
    
    // If the product hasn't been pulled today, estimate its average daily velocity based on its status
    const baseDailyVelocity = productTodayDecrease > 0 
      ? productTodayDecrease 
      : (p.productStatus === "LOW_STOCK" ? 4 : 2);

    // 4. Apply the trend weight computed from weekly history
    const predicted24hDemand = Math.max(1, Math.round(baseDailyVelocity * next24hTrendWeight));

    // 5. Calculate remaining hours of stock
    const hourlyVelocity = predicted24hDemand / 24;
    const hoursLeft = Math.round(currentQty / (hourlyVelocity || 0.1));

    let riskLevel = "منخفض";
    let badgeStyle = "bg-[#24C78E]/10 text-[#24C78E] border border-[#24C78E]/20";
    let confidence = "متوسط";

    if (hoursLeft <= 6) {
      riskLevel = "خطر حرج للغاية 🚨";
      badgeStyle = "bg-[#F05252]/10 text-[#F05252] border border-[#F05252]/20";
      confidence = "عالٍ جدًا";
    } else if (hoursLeft <= 12) {
      riskLevel = "خطر مرتفع ⚠️";
      badgeStyle = "bg-[#F5A524]/10 text-[#F5A524] border border-[#F5A524]/20";
      confidence = "عالٍ";
    } else if (hoursLeft <= 24) {
      riskLevel = "خطر متوسط ⚡";
      badgeStyle = "bg-[#F5A524]/5 text-[#F5A524]/80 border border-[#F5A524]/10";
      confidence = "متوسط";
    } else {
      riskLevel = "مستقر آمن ✅";
      badgeStyle = "bg-[#24C78E]/10 text-[#24C78E] border border-[#24C78E]/20";
      confidence = "مستقر";
    }

    return {
      hoursLeft,
      predicted24hDemand,
      riskLevel,
      badgeStyle,
      confidence
    };
  };

  const predictedStockoutProducts = products
    .filter(p => p.currentQuantity !== null && p.currentQuantity <= 60)
    .map(p => {
      const prediction = getWeeklyPredictiveRisk(p);
      return { product: p, ...prediction };
    })
    .sort((a, b) => a.hoursLeft - b.hoursLeft)
    .slice(0, 5);


  return (
    <div className="space-y-6">
      
      {/* Disclaimer banner */}
      <div className="bg-[#12233A] border border-[#20324A] p-4 rounded-2xl flex items-start gap-3 text-right">
        <Info className="w-5 h-5 text-[#2F80FF] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-black text-[#F4F7FB]">إقرار إحصائي وأمني هام للمسوقين والتاجر</h4>
          <p className="text-[11px] text-[#9FB0C5] leading-relaxed">
            مؤشر نقص الكمية هو تقدير مبني بالكامل على رصد فترات المخازن التلقائية لكتالوج صفقة المباشر، ولا يُمثل بالضرورة دليلاً مؤكداً ومباشراً لعدد المبيعات الفعلية. الهدف الأساسي هو إخطارك بالكميات المتاحة حتى لا تهدر ميزانيتك الإعلانية على منتجات نافدة أو قريبة النفاذ.
          </p>
        </div>
      </div>

      {/* 🛡️ Data Accuracy Auditor Card */}
      <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-right">
          <div>
            <h3 className="text-sm font-black text-[#F4F7FB] flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-[#2F80FF]" />
              نظام التحقق من دقة ومطابقة البيانات
            </h3>
            <p className="text-[10px] text-[#9FB0C5] mt-0.5">
              مقارنة ذكية لحظية بين آخر طابع زمني لمزامنة الكتالوج وآخر عملية سحب أو توريد مسجلة بالمستودعات.
            </p>
          </div>
          
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => performAccuracyCheck()}
              disabled={checkingAccuracy || syncingAccuracy}
              className="px-3 py-1.5 bg-[#07111F] border border-[#20324A] hover:bg-[#12233A] text-[#9FB0C5] hover:text-[#F4F7FB] text-[10px] font-bold rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="إعادة الفحص المباشر"
            >
              <RefreshCw className={`w-3 h-3 ${checkingAccuracy ? "animate-spin" : ""}`} />
              إعادة فحص الدقة
            </button>

            <button
              onClick={handleAccuracySync}
              disabled={checkingAccuracy || syncingAccuracy}
              className="px-3 py-1.5 bg-[#2F80FF] hover:bg-[#1a6edb] text-white text-[10px] font-bold rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-md shadow-[#2F80FF]/10"
            >
              <RefreshCw className={`w-3 h-3 ${syncingAccuracy ? "animate-spin" : ""}`} />
              {syncingAccuracy ? "جاري المطابقة والمزامنة..." : "تحديث ومطابقة فورية"}
            </button>
          </div>
        </div>

        {checkingAccuracy ? (
          <div className="bg-[#07111F]/30 border border-[#20324A]/40 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3">
            <div className="w-7 h-7 border-2 border-[#2F80FF] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#9FB0C5] font-bold animate-pulse">جاري تدقيق قنوات المزامنة ومطابقة حركات المخازن المباشرة...</span>
          </div>
        ) : accuracyError ? (
          <div className="bg-[#F05252]/10 border border-[#F05252]/20 p-4 rounded-2xl flex items-center gap-2.5 text-[#F05252] text-xs font-bold">
            <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
            <span>{accuracyError}</span>
          </div>
        ) : accuracy ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Status Summary */}
            <div className={`lg:col-span-5 rounded-2xl p-4.5 border flex flex-col justify-between space-y-4 ${
              accuracy.isInstantaneous 
                ? "bg-[#24C78E]/5 border-[#24C78E]/25 text-[#24C78E]" 
                : "bg-[#F5A524]/5 border-[#F5A524]/20 text-[#F5A524]"
            }`}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {accuracy.isInstantaneous ? (
                    <div className="p-1.5 bg-[#24C78E]/10 rounded-lg">
                      <ShieldCheck className="w-5 h-5 text-[#24C78E]" />
                    </div>
                  ) : (
                    <div className="p-1.5 bg-[#F5A524]/10 rounded-lg">
                      <ShieldAlert className="w-5 h-5 text-[#F5A524]" />
                    </div>
                  )}
                  <span className="text-xs font-black">حالة دقة الأرقام: {accuracy.statusText}</span>
                </div>
                <p className="text-[11px] text-[#9FB0C5] leading-relaxed">
                  {accuracy.reason}
                </p>
              </div>

              <div className="border-t border-[#20324A]/40 pt-3 flex items-center justify-between text-[10px]">
                <span className="text-[#9FB0C5]">التطابق البرمجي:</span>
                <span className={`font-mono font-black ${accuracy.isInstantaneous ? "text-[#24C78E]" : "text-[#F5A524]"}`}>
                  {accuracy.isInstantaneous ? "100% (لحظي تماماً)" : "قد يحتاج لتحديث"}
                </span>
              </div>
            </div>

            {/* Time Comparison Timeline Visualizer */}
            <div className="lg:col-span-7 bg-[#07111F]/50 border border-[#20324A]/40 rounded-2xl p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <span className="text-[10px] text-[#9FB0C5] block font-bold">مقارنة زمنية لتدفق حركات المخازن (دقيقة بدقيقة):</span>
                
                <div className="relative border-r-2 border-[#20324A] pr-4 mr-2 py-1 space-y-4">
                  {/* Sync Event */}
                  <div className="relative z-50">
                  <DateRangePicker 
                    startDate={selectedHourlyDateStart} 
                    endDate={selectedHourlyDateEnd} 
                    onChange={(start, end) => {
                      setSelectedHourlyDateStart(start);
                      setSelectedHourlyDateEnd(end);
                    }} 
                    align="right"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Analytics Volatility Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-right">
              <div className="bg-[#07111F]/60 border border-[#20324A]/40 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] text-[#9FB0C5] font-medium block">إجمالي قطع السحب اليومي</span>
                <strong className="text-lg font-black font-mono text-[#F4F7FB] mt-1.5">
                  {loadingHourly ? "..." : `${hourlyStats.total} قطعة`}
                </strong>
              </div>
              
              <div className="bg-[#07111F]/60 border border-[#20324A]/40 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] text-[#9FB0C5] font-medium block">متوسط السحب بالساعة</span>
                <strong className="text-lg font-black font-mono text-[#24C78E] mt-1.5">
                  {loadingHourly ? "..." : `${hourlyStats.average} قطعة/س`}
                </strong>
              </div>

              <div className="bg-[#07111F]/60 border border-[#20324A]/40 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] text-[#9FB0C5] font-medium block">ساعة الذروة القصوى</span>
                <div className="mt-1.5 flex flex-col">
                  <strong className="text-sm font-black text-[#F5A524]">
                    {loadingHourly ? "..." : formatHourLocal(hourlyStats.peakHour)}
                  </strong>
                  <span className="text-[8px] text-[#9FB0C5]/70">({hourlyStats.peakVal} قطعة)</span>
                </div>
              </div>

              <div className="bg-[#07111F]/60 border border-[#20324A]/40 p-3.5 rounded-2xl flex flex-col justify-between">
                <span className="text-[9px] text-[#9FB0C5] font-medium block">مؤشر التقلب والاضطراب</span>
                <div className="mt-1.5 flex flex-col">
                  <strong className="text-sm font-black text-red-400">
                    {loadingHourly ? "..." : `±${hourlyStats.volatility}`}
                  </strong>
                  <span className="text-[8px] text-gray-400">({hourlyStats.volatilityText})</span>
                </div>
              </div>
            </div>

            {/* Main Chart Area */}
            {loadingHourly ? (
              <div className="h-64 w-full bg-[#07111F]/30 border border-[#20324A]/40 rounded-2xl flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-[#2F80FF] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[#9FB0C5] font-bold animate-pulse">جاري تحميل تقلبات السحب وإحصائيات التذبذب...</span>
              </div>
            ) : hourlyData.length === 0 ? (
              <div className="h-64 w-full bg-[#07111F]/30 border border-[#20324A]/40 rounded-2xl flex flex-col items-center justify-center space-y-2 text-center">
                <Info className="w-8 h-8 text-[#9FB0C5]/40" />
                <p className="text-xs font-bold text-[#F4F7FB]">لا توجد بيانات حركة مستودع مرصودة لهذا اليوم</p>
                <p className="text-[10px] text-gray-400">يرجى اختيار تاريخ نشط للرصد أو تحديث ومطابقة البيانات</p>
              </div>
            ) : (
              <div className="pt-2">
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={hourlyData.map(h => ({
                        ...h,
                        displayWithdrawals: h.totalWithdrawals !== null ? h.totalWithdrawals : 0
                      }))}
                      margin={{ top: 15, right: 15, left: -25, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#20324A" opacity={0.3} vertical={false} />
                      <XAxis 
                        dataKey="hour" 
                        stroke="#9FB0C5" 
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        dy={6}
                        tickFormatter={(val) => `${val}:00`}
                      />
                      <YAxis 
                        stroke="#9FB0C5" 
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        dx={-6}
                      />
                      <Tooltip 
                        content={<VolatilityTooltip />} 
                        cursor={{ stroke: '#20324A', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Line 
                        type="monotone"
                        name="القطع المسحوبة"
                        dataKey="displayWithdrawals" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#0D1B2D', stroke: '#3B82F6', strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: '#3B82F6', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                        connectNulls={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex items-center justify-between border-t border-[#20324A]/30 pt-3 text-[9px] text-[#9FB0C5]">
                  <span className="font-medium">المحور الأفقي: ساعات اليوم (00:00 إلى 23:00) | المحور الرأسي: إجمالي القطع المسحوبة</span>
                  <span className="text-[#3B82F6] font-bold">● منحنى تذبذب حركة المخازن</span>
                </div>
              </div>
            )}
          </div>
          </div>
        </>
      ) : null}
      {/* 📅 Weekly Siphons and Inventory Activity Report */}
      <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-5 text-right">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-[#F4F7FB] flex items-center gap-2">
              <TrendingDown className="w-4.5 h-4.5 text-[#24C78E]" />
              تقرير السحب والنشاط الأسبوعي المحفوظ
            </h3>
            <p className="text-[10px] text-[#9FB0C5] mt-0.5">مقارنة حركة السحب اليومية والكميات المزودة على مدار السبعة أيام الماضية</p>
          </div>
          <span className="text-[10px] text-[#24C78E] bg-[#24C78E]/10 px-2.5 py-1 rounded-full font-bold border border-[#24C78E]/20">
            مُحدَّث ومحفوظ تلقائياً
          </span>
        </div>

        {/* Weekly Totals KPIs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#07111F]/60 border border-[#20324A]/40 p-4 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-[#9FB0C5] block font-medium">إجمالي السحب الأسبوعي</span>
              <strong className="text-2xl text-[#24C78E] font-black font-mono">
                {weeklyHistory.reduce((sum, h) => sum + h.quantityDecrease, 0)} <span className="text-[10px] font-sans font-normal text-[#9FB0C5]">قطعة</span>
              </strong>
            </div>
            <div className="p-3 bg-[#24C78E]/10 rounded-xl border border-[#24C78E]/20 text-[#24C78E]">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#07111F]/60 border border-[#20324A]/40 p-4 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-[#9FB0C5] block font-medium">إجمالي التوريد والتخزين الأسبوعي</span>
              <strong className="text-2xl text-[#F5A524] font-black font-mono">
                +{weeklyHistory.reduce((sum, h) => sum + h.restockAmount, 0)} <span className="text-[10px] font-sans font-normal text-[#9FB0C5]">قطعة</span>
              </strong>
            </div>
            <div className="p-3 bg-[#F5A524]/10 rounded-xl border border-[#F5A524]/20 text-[#F5A524]">
              <Database className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Day-by-Day Comparative List & Progress Bar */}
        <div className="space-y-3">
          {weeklyHistory.map((day) => {
            const maxDecrease = Math.max(...weeklyHistory.map(h => h.quantityDecrease), 1);
            const pct = Math.min((day.quantityDecrease / maxDecrease) * 100, 100);
            
            // Format calendar date in Cairo/Arabic style (e.g., 30 يونيو)
            const dateArabic = (() => {
              try {
                const parts = day.date.split("-");
                if (parts.length === 3) {
                  const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                  return dObj.toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
                }
                return day.date;
              } catch {
                return day.date;
              }
            })();

            const isToday = day.date === getCairoTodayStr();

            return (
              <div 
                key={day.date} 
                className={`p-3.5 rounded-xl border transition duration-150 ${
                  isToday 
                    ? "bg-[#112F25]/40 border-[#24C78E]/30" 
                    : "bg-[#07111F]/30 border-[#20324A]/30 hover:bg-[#0D1B2D]/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-xs text-[#F4F7FB]">{day.dayName}</strong>
                    <span className="text-[10px] text-[#9FB0C5] font-mono">({dateArabic})</span>
                    {isToday && (
                      <span className="text-[8px] bg-[#24C78E] text-black px-1.5 py-0.5 rounded font-extrabold uppercase animate-pulse">
                        اليوم (مباشر)
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-[10px] text-[#9FB0C5]">
                    <div className="flex items-center gap-1">
                      <span>السحب:</span>
                      <strong className="text-[#24C78E] font-mono">{day.quantityDecrease} قطعة</strong>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>التوريد:</span>
                      <strong className="text-[#FBBF24] font-mono">+{day.restockAmount} قطعة</strong>
                    </div>
                  </div>
                </div>

                {/* Combined Progress bar */}
                <div className="h-2 w-full bg-[#12233A] rounded-full overflow-hidden flex">
                  <div 
                    style={{ width: `${pct}%` }}
                    className="h-full bg-gradient-to-r from-[#24C78E]/40 to-[#24C78E] rounded-full transition-all duration-500"
                    title={`سحوبات اليوم: ${day.quantityDecrease} قطعة`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Critical stock + Sync status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Alerts & Critical Stocks */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-4">
          <div className="flex justify-between items-center text-right">
            <h3 className="text-sm font-bold text-[#F4F7FB] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#F05252]" />
              السلع الحرجة ووشيكة النفاد بالمخازن
            </h3>
            <span className="text-[10px] text-[#F05252] bg-[#F05252]/10 px-2.5 py-0.5 rounded-full font-bold border border-[#F05252]/20">
              {products.filter(p => p.currentQuantity !== null && p.currentQuantity <= 20).length} حرجة
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {products
              .filter(p => p.currentQuantity !== null && p.currentQuantity <= 20)
              .slice(0, 5)
              .map((p, index) => {
                const isOutOfStock = p.currentQuantity === 0;
                return (
                  <div 
                    key={`${p.id}-${index}`}
                    onClick={() => onProductClick(p)}
                    className="bg-[#07111F]/50 hover:bg-[#12233A] border border-[#20324A]/40 p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition hover:border-[#20324A]"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={p.imageUrl} 
                        className="w-10 h-10 rounded-lg object-cover bg-[#0D1B2D] shrink-0 border border-[#20324A]/50" 
                        alt="" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="text-right">
                        <h4 className="text-xs font-bold text-[#F4F7FB] line-clamp-1">{p.name}</h4>
                        <span className="text-[9px] text-[#9FB0C5] font-mono block mt-0.5">{p.sku}</span>
                      </div>
                    </div>
                    
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-black shrink-0 ${
                      isOutOfStock 
                        ? "bg-[#F05252]/10 text-[#F05252] border border-[#F05252]/20" 
                        : "bg-[#F5A524]/10 text-[#F5A524] border border-[#F5A524]/20"
                    }`}>
                      {isOutOfStock ? "نفد كلياً" : `متبقي ${p.currentQuantity} قطعة`}
                    </span>
                  </div>
                );
              })}

            {products.filter(p => p.currentQuantity !== null && p.currentQuantity <= 20).length === 0 && (
              <div className="text-center py-12 text-xs text-[#9FB0C5] bg-[#07111F]/30 rounded-xl border border-dashed border-[#20324A]/30">
                لا توجد سلع بمستويات مخزون حرجة حالياً.
              </div>
            )}
          </div>
        </div>

        {/* Sync runs & activities */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-[#F4F7FB] flex items-center gap-2 text-right">
            <Database className="w-4 h-4 text-[#2F80FF]" />
            سجلات المزامنة وحالات الرصد الأخيرة
          </h3>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {syncRuns.slice(0, 5).map((run) => (
              <div key={run.id} className="bg-[#07111F]/50 border border-[#20324A]/40 p-3 rounded-xl space-y-2 text-xs text-right">
                <div className="flex justify-between items-center border-b border-[#20324A]/20 pb-1.5">
                  <span className="font-mono text-[9px] text-[#9FB0C5]">{run.id}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                    run.status === "COMPLETED" ? "bg-[#24C78E]/10 text-[#24C78E]" : "bg-[#F05252]/10 text-[#F05252]"
                  }`}>
                    {run.status === "COMPLETED" ? "مكتملة بنجاح" : "فشلت المزامنة"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-[#9FB0C5]">
                  <div>التوقيت: <strong className="text-[#F4F7FB] font-mono">{formatTimeArabic(run.startedAt)} ({getDayArabic(run.startedAt)})</strong></div>
                  <div>المستلم: <strong className="text-[#F4F7FB]">{run.productsReceived} سلع</strong></div>
                  <div className="text-[#F5A524]">سحوبات: <strong>{run.quantityDecreasesDetected} عمليات</strong></div>
                  <div className="text-[#8B5CF6]">شحنات مخازن: <strong>{run.restocksDetected} إمدادات</strong></div>
                </div>
              </div>
            ))}

            {syncRuns.length === 0 && (
              <div className="text-center py-12 text-xs text-[#9FB0C5] bg-[#07111F]/30 rounded-xl border border-dashed border-[#20324A]/30">
                لا توجد سجلات مزامنة مسجلة حالياً.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Stock risk prediction panel */}
      <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#F4F7FB] flex items-center gap-2 text-right">
            <Clock className="w-4.5 h-4.5 text-[#F5A524]" />
            توقعات النفاذ والتحليل التنبئي للـ 24 ساعة القادمة (Stockout Predictions)
          </h3>
          <p className="text-[10px] text-[#9FB0C5] mt-1 text-right leading-relaxed">
            تحليل ذكي يعتمد على الاتجاه الأسبوعي للطلب <strong className="text-[#2F80FF]">({weeklyHistory.length} أيام مسجلة)</strong> ومعدل السحب اليومي التراكمي لكل سلعة للتنبؤ بالكميات المتوقع استهلاكها والوقت المقدر لنفاذ المخزون.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#20324A] text-[#9FB0C5] pb-2 font-bold">
                <th className="py-2.5">السلعة</th>
                <th className="py-2.5 text-center">المخزون الحالي</th>
                <th className="py-2.5 text-center">الطلب المتوقع (24 ساعة)</th>
                <th className="py-2.5 text-center">الوقت المتبقي المقدر</th>
                <th className="py-2.5 text-center">مستوى خطورة النفاذ</th>
                <th className="py-2.5 text-center">ثقة التوقع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#20324A]/40 text-[#F4F7FB]">
              {predictedStockoutProducts.map((item, index) => {
                const { product: p, hoursLeft, predicted24hDemand, riskLevel, badgeStyle, confidence } = item;
                return (
                  <tr key={`${p.id}-${index}`} className="hover:bg-[#12233A]/20 transition">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={p.imageUrl} 
                          className="w-8 h-8 rounded-lg object-cover bg-[#07111F] border border-[#20324A]/40" 
                          alt="" 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <span className="font-bold block text-[11px] hover:text-[#2F80FF] transition cursor-pointer" onClick={() => onProductClick(p)}>{p.name}</span>
                          <span className="text-[9px] text-[#9FB0C5] font-mono">{p.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono font-bold">
                      {p.currentQuantity === 0 ? (
                        <span className="text-[#F05252]">نفد ❌</span>
                      ) : (
                        <span>{p.currentQuantity} قطعة</span>
                      )}
                    </td>
                    <td className="py-3 text-center font-mono text-[#F5A524] font-black">~ {predicted24hDemand} قطع</td>
                    <td className="py-3 text-center font-mono font-bold">
                      {hoursLeft === 0 ? (
                        <span className="text-[#F05252] font-black">نفد بالفعل</span>
                      ) : hoursLeft < 1 ? (
                        <span className="text-[#F05252] font-black">أقل من ساعة 🚨</span>
                      ) : hoursLeft <= 24 ? (
                        <span className="text-[#F5A524] font-black">~ {hoursLeft} ساعة ⚠️</span>
                      ) : (
                        <span className="text-[#24C78E]">~ {Math.round(hoursLeft / 24)} يوم ({hoursLeft} ساعة)</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black ${badgeStyle}`}>
                        {riskLevel}
                      </span>

                    </td>
                    <td className="py-3 text-center font-bold text-[#9FB0C5]">{confidence}</td>
                  </tr>
                );
              })}
              {predictedStockoutProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#9FB0C5]">
                    لا توجد منتجات منخفضة المخزون حالياً لتوليد توقعات النفاذ التنبئية.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  );
}
