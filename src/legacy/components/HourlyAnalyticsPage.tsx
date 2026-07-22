// @ts-nocheck
import React, { useState, useEffect } from "react";
import { safeFetchJson } from "../lib/api";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { 
  Clock, 
  Calendar, 
  Filter, 
  Database, 
  TriangleAlert, 
  TrendingDown, 
  TrendingUp, 
  Hourglass, 
  Activity, 
  Info, 
  Eye, 
  CheckCircle,
  CircleHelp,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Product, Hour24, formatCairoHourArabic, AnalyticsNavigationIntent } from "../types";
import { getCairoHour24, getCairoTodayStr, addDaysToDateStr, getCairoYesterdayStr } from "../shared/time";
import { formatCairoTime } from "../shared/time";
import { DateRangePicker } from "./DateRangePicker";

interface HourlyAnalyticsPageProps {
  onProductClick: (product: Product) => void;
  selectedPlatform: string;
  navigationIntent?: AnalyticsNavigationIntent;
  clearNavigationIntent?: () => void;
  revision: string | null;
  defaultDate?: string;
}

export default function HourlyAnalyticsPage(props: HourlyAnalyticsPageProps) {
  const {
    onProductClick,
    selectedPlatform,
    navigationIntent,
    clearNavigationIntent,
    defaultDate
  } = props;

  // Query Filters & States
  const [selectedDateStart, setSelectedDateStart] = useState<string>("");
  const [selectedDateEnd, setSelectedDateEnd] = useState<string>("");
  const [platform, setPlatform] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [includeAnomalies, setIncludeAnomalies] = useState<boolean>(false);
  const [focusMetric, setFocusMetric] = useState<'pieces' | 'events' | 'products'>('pieces');
  const [sortConfig, setSortConfig] = useState<{ key: 'quantity_decrease' | 'current_quantity' | 'restock_amount', direction: 'ascending' | 'descending' }>({ key: 'quantity_decrease', direction: 'descending' });

  const formatShortCairoHour = (hr: number) => {
    if (hr === 0) return "12 ص";
    if (hr < 12) return `${hr} ص`;
    if (hr === 12) return "12 م";
    return `${hr - 12} م`;
  };

  

  const handlePrevDay = () => {
    setSelectedDateStart(prev => prev ? addDaysToDateStr(prev, -1) : prev);
    setSelectedDateEnd(prev => prev ? addDaysToDateStr(prev, -1) : prev);
  };

  const handleNextDay = () => {
    if (!selectedDateStart) return;
    const todayStr = getCairoTodayStr();
    const next = addDaysToDateStr(selectedDateStart, 1);
    if (next <= todayStr) {
      setSelectedDateStart(next);
      setSelectedDateEnd(next);
    }
  };

  // Data States
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [selectedHour24, setSelectedHour24] = useState<Hour24>(getCairoHour24());
  const [hourlyProducts, setHourlyProducts] = useState<any[]>([]);
  const [peakAnalysis, setPeakAnalysis] = useState<any>(null);
  const [weekdayPatterns, setWeekdayPatterns] = useState<any[]>([]);
  const [multiHourLeaders, setMultiHourLeaders] = useState<any[]>([]);
  const [categoryLeaders, setCategoryLeaders] = useState<any[]>([]);
  const [stockoutRisk, setStockoutRisk] = useState<any[]>([]);

  const sortedProducts = React.useMemo(() => {
    const sortableProducts = [...hourlyProducts];
    if (sortConfig !== null) {
      sortableProducts.sort((a, b) => {
        const aVal = a[sortConfig.key === 'quantity_decrease' ? 'quantity_decrease' : 'current_quantity'] || 0;
        const bVal = b[sortConfig.key === 'quantity_decrease' ? 'quantity_decrease' : 'current_quantity'] || 0;
        if (aVal < bVal) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableProducts;
  }, [hourlyProducts, sortConfig]);

  const requestSort = (key: 'quantity_decrease' | 'current_quantity' | 'restock_amount') => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };
  
  // 10-Minute High-Precision Interval Monitoring states
  const [tenMinuteData, setTenMinuteData] = useState<any>(null);
  const [loadingTenMinute, setLoadingTenMinute] = useState<boolean>(false);
  
  // Status States
  const [loadingHourly, setLoadingHourly] = useState<boolean>(true);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [loadingPeak, setLoadingPeak] = useState<boolean>(true);
  const [loadingWeekdays, setLoadingWeekdays] = useState<boolean>(true);
  const [loadingRisk, setLoadingRisk] = useState<boolean>(true);
  const [cairoTimeStr, setCairoTimeStr] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'heatmap'>('heatmap');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ dayName: string, hour: number, averageDecrease: number, label: string } | null>(null);

  // Initialize selectedDate to the latest Cairo date that actually has data.
  useEffect(() => {
    setSelectedDateStart(defaultDate || getCairoTodayStr());
    setSelectedDateEnd(defaultDate || getCairoTodayStr());
    setPlatform(selectedPlatform);
  }, [selectedPlatform, defaultDate]);

  // Handle revision change for refetching
  useEffect(() => {
    if (props.revision) {
      setIsRefreshing(true);
      // Trigger all refetches
      Promise.all([
          fetchHourlyMetrics(),
          fetchPeakAnalysis(),
          fetchWeekdayPatterns(),
          fetchRiskAndStreaks(),
          fetchHourBundle(selectedDateStart, selectedHour24)
      ]).finally(() => setIsRefreshing(false));
    }
  }, [props.revision]);

  // Handle navigation intents from other pages
  useEffect(() => {
    if (navigationIntent) {
      if (navigationIntent.type === "last-completed-hour") {
        setSelectedDateStart(navigationIntent.date);
        setSelectedDateEnd(navigationIntent.date);
        setSelectedHour24(navigationIntent.hour);
        setFocusMetric("pieces");
      } else if (navigationIntent.type === "today") {
        setSelectedDateStart(navigationIntent.date);
        setSelectedDateEnd(navigationIntent.date);
        setFocusMetric(navigationIntent.metric);
        if (navigationIntent.metric === "products") {
          setSelectedHour24(-1); // -1 signifies "all" hours (products grouped for today)
        } else {
          setSelectedHour24(getCairoHour24());
        }
      }
      if (clearNavigationIntent) {
        clearNavigationIntent();
      }
    }
  }, [navigationIntent]);

  // Cairo Live Clock Simulator
  useEffect(() => {
    const updateClock = () => {
      setCairoTimeStr(formatCairoTime(new Date()));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // 20-minute auto-refresh
  useEffect(() => {
    const interval = setInterval(async () => {
       setIsRefreshing(true);
       await Promise.all([
           fetchHourlyMetrics(),
           fetchPeakAnalysis(),
           fetchWeekdayPatterns(),
           fetchRiskAndStreaks(),
           fetchHourBundle(selectedDateStart, selectedHour24)
       ]).finally(() => setIsRefreshing(false));
    }, 20 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [selectedDateStart, selectedDateEnd, selectedHour24]);

  // Refresh on focus
  useEffect(() => {
    const handleFocus = async () => {
      setIsRefreshing(true);
      await Promise.all([
          fetchHourlyMetrics(),
          fetchPeakAnalysis(),
          fetchWeekdayPatterns(),
          fetchRiskAndStreaks(),
          fetchHourBundle(selectedDateStart, selectedHour24)
      ]).finally(() => setIsRefreshing(false));
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedDateStart, selectedDateEnd, selectedHour24]);

  // Fetch hourly metrics list on date/platform/category change
  const fetchHourlyMetrics = async () => {
    if (!selectedDateStart) return;
    setLoadingHourly(true);
    setHourlyData([]);
    try {
      const params = new URLSearchParams({
        date: selectedDateStart,
        platform,
        category,
        includeAnomalies: String(includeAnomalies)
      });
      // Call the redesigned endpoint
      const payload = await safeFetchJson<any>(`/api/analytics/hourly-withdrawals?${params.toString()}`);
      if (payload.success) {
        if (payload.selectedDate && payload.selectedDate !== selectedDateStart) {
          console.warn('STALE_DATE_RESPONSE', payload.selectedDateStart, selectedDateStart);
          return;
        }
        
        // Map the new format to the expected format by the UI, or adapt the UI
        // The new endpoint returns an array of hours in payload.hours
        const mappedData = payload.hours.map((h: any) => {
          const hr = h.hour;
          const label = hr === 0 ? "12:00 ص - 12:59 ص" :
                        hr < 12 ? `${String(hr).padStart(2, '0')}:00 ص - ${String(hr).padStart(2, '0')}:59 ص` :
                        hr === 12 ? "12:00 م - 12:59 م" :
                        `${String(hr - 12).padStart(2, '0')}:00 م - ${String(hr - 12).padStart(2, '0')}:59 م`;
          return {
            hour: h.hour,
            hour_label: label,
            quantity_decrease: h.totalWithdrawals !== null ? h.totalWithdrawals : 0,
            withdrawal_events: h.productsWithWithdrawals || 0,
            affected_products: h.productsWithWithdrawals || 0,
            data_status: h.status === 'COMPLETE' && h.totalWithdrawals !== null && h.totalWithdrawals > 0 ? 'SUCCESS_WITH_ACTIVITY' : (h.status === 'COMPLETE' && h.totalWithdrawals === 0 ? 'SUCCESS_ZERO' : (h.status === 'RUNNING' || h.status === 'PENDING' ? 'CURRENT_INCOMPLETE' : (h.status === 'FAILED' ? 'FAILED' : (h.status === 'PARTIAL' ? 'PARTIAL' : 'NOT_SCHEDULED')))),
            highest_product_name: h.status === 'COMPLETE' && h.totalWithdrawals === 0 ? "لا يوجد مسحوبات مسجلة" : (h.status === 'FAILED' ? "فشل جمع البيانات" : (h.status === 'NOT_STARTED' ? "لم يبدأ بعد" : (h.status === 'PARTIAL' ? "بيانات غير مكتملة" : "غير معروف"))),
            data_completeness_percentage: h.status === 'NOT_STARTED' ? 100 : (h.expectedProductCount > 0 ? Math.min(100, Math.round((h.successfulProductCount / h.expectedProductCount) * 100)) : 100)
          };
        });
        setHourlyData(mappedData);
      }
    } catch (e) {
      console.error("Failed to load hourly metrics", e);
    } finally {
      setLoadingHourly(false);
    }
  };

  
  // Fetch combined hour bundle
  const fetchHourBundle = async (
    date: string,
    hour: number,
    signal?: AbortSignal
  ) => {
    if (!date) return;
    if (hour === -1) {
      setHourlyProducts([]);
      setTenMinuteData(null);
      return; 
    }
    
    setHourlyProducts([]);
    setTenMinuteData(null);
    setLoadingProducts(true);
    setLoadingTenMinute(true);
    
    try {
      const params = new URLSearchParams({
        date,
        hour: String(hour),
        revision: props.revision || ""
      });
      
      const [prodPayload, breakdownPayload] = await Promise.all([
        safeFetchJson<any>(`/api/analytics/hourly-withdrawals/${hour}/products?${params.toString()}`, { signal }),
        safeFetchJson<any>(`/api/withdrawals/hour-breakdown?${params.toString()}`, { signal })
      ]);
      
      if (prodPayload.revision && props.revision && prodPayload.revision !== props.revision) return;
      
      if (prodPayload.success) {
        if (prodPayload.selectedDate && prodPayload.selectedDate !== date) {
          console.warn('STALE_DATE_RESPONSE', prodPayload.selectedDateStart, date);
          return;
        }
        setHourlyProducts(prodPayload.products);
      }
      if (breakdownPayload.success) {
        setTenMinuteData({
           summary: { withdrawn_pieces: breakdownPayload.summary.withdrawn_pieces, withdrawal_events: breakdownPayload.summary.withdrawal_events, affected_products: breakdownPayload.summary.affected_products },
           intervals: breakdownPayload.intervals.map((i: any) => ({
             slot: i.slot,
             start_minute: i.slot * 20,
             end_minute: i.slot * 20 + 19,
             interval_label: i.intervalLabel,
             intervalLabel: i.intervalLabel,
             withdrawn_pieces: i.withdrawnPieces,
             withdrawnPieces: i.withdrawnPieces,
             withdrawal_events: i.withdrawalEvents,
             withdrawalEvents: i.withdrawalEvents,
             affected_products: i.affectedProducts,
             affectedProducts: i.affectedProducts,
             data_status: i.dataStatus,
             dataStatus: i.dataStatus,
             dataCompletenessPercentage: i.dataCompletenessPercentage !== undefined ? i.dataCompletenessPercentage : 100
           }))
        });
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error("Failed to load hour bundle", e);
      setHourlyProducts([]);
      setTenMinuteData(null);
    } finally {
      setLoadingProducts(false);
      setLoadingTenMinute(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setHourlyProducts([]);
    if (selectedHour24 !== -1) {
      fetchHourBundle(selectedDateStart, selectedHour24, controller.signal);
    }
    return () => controller.abort();
  }, [selectedHour24, selectedDateStart, platform, category, includeAnomalies]);


  // Fetch peak analysis & metadata
  const fetchPeakAnalysis = async () => {
    if (!selectedDateStart) return;
    setLoadingPeak(true);
    try {
      const params = new URLSearchParams({ platform, category, date: selectedDateStart });
      const payload = await safeFetchJson<any>(`/api/hourly-peak-analysis?${params.toString()}`);
      if (payload.success) {
        setPeakAnalysis(payload);
      }
    } catch (e: any) {
      if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
        console.warn("Failed to load peak analysis (transient):", e.message);
      } else {
        console.error("Failed to load peak analysis", e);
      }
    } finally {
      setLoadingPeak(false);
    }
  };

  // Fetch weekday patterns
  const fetchWeekdayPatterns = async () => {
    setLoadingWeekdays(true);
    try {
      const params = new URLSearchParams({ platform, category });
      const payload = await safeFetchJson<any>(`/api/weekday-patterns?${params.toString()}`);
      if (payload.success) {
        setWeekdayPatterns(payload.data);
      }
    } catch (e: any) {
      if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
        console.warn("Failed to load weekday patterns (transient):", e.message);
      } else {
        console.error("Failed to load weekday patterns", e);
      }
    } finally {
      setLoadingWeekdays(false);
    }
  };

  // Fetch risk forecasts, leaderboards, streaks
  const fetchRiskAndStreaks = async () => {
    if (!selectedDateStart) return;
    setLoadingRisk(true);
    try {
      const params = new URLSearchParams({ platform, date: selectedDateStart });
      
      const [dataRisk, dataLeaders, dataStreaks] = await Promise.all([
        safeFetchJson<any>(`/api/stockout-risk?${params.toString()}`),
        safeFetchJson<any>(`/api/category-leaders?platform=${platform}&date=${selectedDateStart}`),
        safeFetchJson<any>(`/api/multi-hour-leaders?platform=${platform}&category=${category}&date=${selectedDateStart}`)
      ]);

      if (dataRisk.success) setStockoutRisk(dataRisk.data);
      if (dataLeaders.success) setCategoryLeaders(dataLeaders.data);
      if (dataStreaks.success) setMultiHourLeaders(dataStreaks.data);
    } catch (e: any) {
      if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
        console.warn("Failed to load forecasting metrics (transient):", e.message);
      } else {
        console.error("Failed to load forecasting metrics", e);
      }
    } finally {
      setLoadingRisk(false);
    }
  };

  // Fetch list of categories once on load
  const loadCategories = async () => {
    try {
      const data = await safeFetchJson<any>("/api/dashboard");
      if (data.success) {
        setCategoriesList(data.categories || []);
      }
    } catch (e: any) {
      if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
        console.warn("Failed to fetch categories list (transient):", e.message);
      } else {
        console.error("Failed to fetch categories list", e);
      }
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  

  // Sync state triggers
  useEffect(() => {
    fetchHourlyMetrics();
    fetchPeakAnalysis();
    fetchWeekdayPatterns();
    fetchRiskAndStreaks();
  }, [selectedDateStart, selectedDateEnd, platform, category, includeAnomalies]);

  // Color logic for heatmap cells based on decrease severity
  const getHeatmapColor = (dec: number | null) => {
    if (dec === null) return "bg-gray-800/30 border border-dashed border-gray-600 hover:bg-gray-800/50";
    if (dec === 0) return "bg-[#112239] hover:bg-[#152a47]";
    if (dec <= 5) return "bg-[#1c4021] hover:bg-[#23522a] border border-[#24C78E]/30";
    if (dec <= 15) return "bg-[#33501a] hover:bg-[#426622] border border-[#F5A524]/30";
    if (dec <= 35) return "bg-[#553b11] hover:bg-[#6e4d16] border border-orange-500/30";
    return "bg-[#59161a] hover:bg-[#731d22] border border-[#F05252]/40";
  };

  const getHeatmapText = (dec: number) => {
    if (dec === 0) return "text-[#a5a5c8]/40";
    if (dec <= 5) return "text-[#24C78E] font-extrabold";
    if (dec <= 15) return "text-[#F5A524] font-extrabold";
    return "text-red-400 font-extrabold";
  };

  const selectedHourDetails = hourlyData.find(h => h.hour === selectedHour24);
  const totalPiecesToday = hourlyData.reduce((sum, h) => sum + Number(h.quantity_decrease || 0), 0);
  const totalEventsToday = hourlyData.reduce((sum, h) => sum + Number(h.withdrawal_events || 0), 0);
  const totalSyncsToday = hourlyData.reduce((sum, h) => sum + Number(h.successful_syncs || 0), 0);
  const totalFailedSyncsToday = hourlyData.reduce((sum, h) => sum + Number(h.failed_syncs || 0), 0);
  const activeHours = hourlyData.filter(h => h.data_status !== 'NOT_SCHEDULED');
  const avgCompletenessToday = activeHours.length > 0 
    ? Math.round(activeHours.reduce((sum, h) => sum + Number(h.data_completeness_percentage || 100), 0) / activeHours.length)
    : 100;

  return (
    <div id="hourly-analytics-view" className="space-y-6 text-right">
      
      {/* 1. Header Banner & Cairo clock */}
      <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#6366f1]" />
            <h2 className="text-xl font-black text-white font-display">لوحة التحليل الفوري للمخازن بالساعات</h2>
          </div>
          <p className="text-xs text-[#a5a5c8] leading-relaxed">
            رصد ومطابقة تحركات المخازن، سحوبات القطع، ومبيعات الكتالوج لكل ساعة بالتوقيت المحلي لجمهورية مصر العربية (توقيت القاهرة — UTC+2).
          </p>
        </div>
        
        {/* Real-time Cairo clock */}
        <div className="bg-[#1c1c47] border border-[#2a2a5c] px-4 py-2.5 rounded-2xl flex items-center gap-3 shrink-0 self-stretch md:self-auto shadow-inner">
          <Clock className="w-5 h-5 text-[#24C78E] animate-pulse" />
          <div className="text-right">
            <span className="text-[10px] text-[#a5a5c8] block font-semibold">توقيت القاهرة الفعلي (توقيت القاهرة — UTC+2)</span>
            <span className="text-sm font-black text-[#f5f5fa] font-mono tracking-wide">{cairoTimeStr || "جاري المزامنة..."}</span>
          </div>
        </div>
      </div>

      {/* 2. Advanced Control Bar Filters */}
      <div className="bg-[#141432] border border-[#2a2a5c] p-5 rounded-3xl flex flex-wrap gap-4 items-center justify-between shadow-lg">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Calendar Picker */}
          <div className="flex flex-col gap-1 text-right">
            <span className="text-[10px] text-[#a5a5c8] font-bold flex items-center gap-1 justify-end">
              <Calendar className="w-3.5 h-3.5 text-[#6366f1]" /> تاريخ المراقبة
            </span>
            <div className="flex items-center gap-1.5 bg-[#1c1c47] border border-[#2a2a5c] rounded-xl px-2.5 h-[38px] select-none">
              
              {/* Prev Day Button */}
              <button 
                onClick={handlePrevDay} 
                className="p-1 hover:bg-[#2a2a5c] rounded-lg transition text-[#a5a5c8] hover:text-white cursor-pointer" 
                title="اليوم السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              {/* Date Input */}
              <div className="relative flex items-center justify-center gap-1 z-50">
                <DateRangePicker 
                  startDate={selectedDateStart || getCairoTodayStr()} 
                  endDate={selectedDateEnd || getCairoTodayStr()} 
                  onChange={(start, end) => {
                    setSelectedDateStart(start);
                    setSelectedDateEnd(end);
                  }} 
                  align="right"
                />
              </div>
              
              {/* Next Day Button */}
              <button 
                onClick={handleNextDay} 
                disabled={!selectedDateStart || selectedDateStart >= getCairoTodayStr()}
                className="p-1 hover:bg-[#2a2a5c] rounded-lg transition text-[#a5a5c8] hover:text-white disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer" 
                title="اليوم التالي"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Splitter */}
              <span className="h-5 w-[1px] bg-[#2a2a5c] mx-1"></span>

              {/* Today shortcut */}
              <button 
                onClick={() => { setSelectedDateStart(getCairoTodayStr()); setSelectedDateEnd(getCairoTodayStr()); }}
                className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition cursor-pointer ${
                  selectedDateStart === getCairoTodayStr() && selectedDateEnd === getCairoTodayStr() ? "bg-[#6366f1] text-white" : "text-[#a5a5c8] hover:bg-[#2a2a5c] hover:text-white"
                }`}
              >
                اليوم
              </button>

              {/* Yesterday shortcut */}
              <button 
                onClick={() => { setSelectedDateStart(getCairoYesterdayStr()); setSelectedDateEnd(getCairoYesterdayStr()); }}
                className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition cursor-pointer ${
                  selectedDateStart === getCairoYesterdayStr() && selectedDateEnd === getCairoYesterdayStr() ? "bg-[#6366f1]/30 text-[#6366f1]" : "text-[#a5a5c8] hover:bg-[#2a2a5c] hover:text-white"
                }`}
              >
                أمس
              </button>
            </div>
          </div>

          {/* Platform Selector */}
          <div className="flex flex-col gap-1 text-right min-w-[130px]">
            <span className="text-[10px] text-[#a5a5c8] font-bold flex items-center gap-1 justify-end">
              <Filter className="w-3.5 h-3.5 text-[#6366f1]" /> المنصة الموردة
            </span>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-[#1c1c47] border border-[#2a2a5c] rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-[#6366f1] transition cursor-pointer"
            >
              <option value="all">كل المنصات (صفقة وتاجر)</option>
              <option value="safka">بوابة صفقة (Safka)</option>
            </select>
          </div>

          {/* Category Selector */}
          <div className="flex flex-col gap-1 text-right min-w-[130px]">
            <span className="text-[10px] text-[#a5a5c8] font-bold flex items-center gap-1 justify-end">
              <Database className="w-3.5 h-3.5 text-[#6366f1]" /> التصنيف الرئيسي
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-[#1c1c47] border border-[#2a2a5c] rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-[#6366f1] transition cursor-pointer"
            >
              <option value="all">كل التصنيفات المدمجة</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Anomalies and Quality indicators toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer bg-[#1c1c47]/60 px-4 py-2 rounded-xl border border-[#2a2a5c]/40 hover:bg-[#1c1c47] transition">
            <input 
              type="checkbox"
              checked={includeAnomalies}
              onChange={(e) => setIncludeAnomalies(e.target.checked)}
              className="w-4 h-4 rounded text-[#6366f1] focus:ring-0 bg-[#0a0a1a] border-[#2a2a5c]"
            />
            <div className="text-right">
              <span className="text-xs font-extrabold text-[#f5f5fa] block">شمل قفزات المخازن الشاذة</span>
              <span className="text-[9px] text-[#a5a5c8] block font-medium">الاستقصاء غير الحقيقي وتعديلات النظام</span>
            </div>
          </label>
        </div>
      </div>

      {/* 3. Hourly Activity Heatmap Grid */}
      <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#2a2a5c]/40 pb-4 gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-[#6366f1]" /> مصفوفة سحوبات المخزون التفاعلية (24 ساعة)
            </h3>
            <p className="text-[10px] text-[#a5a5c8] mt-1">
              مصفوفة لونية ذكية توضح حجم تناقص كميات السلع بكل ساعة بالتوقيت المحلي لجمهورية مصر العربية.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex bg-[#1c1c47] p-0.5 rounded-xl border border-[#2a2a5c] text-xs">
            <button
              onClick={() => {
                setFocusMetric("pieces");
                if (selectedHour24 === -1) setSelectedHour24(getCairoHour24());
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${focusMetric === "pieces" ? "bg-[#6366f1] text-white" : "text-[#a5a5c8] hover:text-white"}`}
            >
              القطع المسحوبة
            </button>
            <button
              onClick={() => {
                setFocusMetric("events");
                if (selectedHour24 === -1) setSelectedHour24(getCairoHour24());
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${focusMetric === "events" ? "bg-[#6366f1] text-white" : "text-[#a5a5c8] hover:text-white"}`}
            >
              عمليات السحب
            </button>
            <button
              onClick={() => {
                setFocusMetric("products");
                setSelectedHour24(-1); // Automatically view all hours products
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${focusMetric === "products" ? "bg-[#6366f1] text-white" : "text-[#a5a5c8] hover:text-white"}`}
            >
              السلع المتأثرة اليوم
            </button>
          </div>
          
          {/* Heatmap Legend */}
          <div className="flex items-center gap-2 text-[9px] text-[#a5a5c8]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#112239]" /> صفر</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#1c4021]" /> خفيف (1-5)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#33501a]" /> متوسط (6-15)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#553b11]" /> مكثف (16-35)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#59161a]" /> انفجاري (35+)</span>
          </div>
        </div>

        {/* Informational Guidance Banner */}
        <div className="bg-[#1c1c47]/60 border border-[#2a2a5c]/75 px-4 py-3 rounded-2xl flex items-start sm:items-center gap-3 text-xs text-[#a5a5c8] leading-relaxed">
          <Info className="w-5 h-5 text-[#6366f1] shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 text-right">
            <span className="text-white font-bold block sm:inline">ملاحظة الرصد والتوقيت:</span>{" "}
            <span>
              تحسب السحوبات والألوان التنبيهية بناءً على الفوارق الزمنية بين جلسات المزامنة الناجحة. الساعات التي تظهر بـ <strong className="text-gray-400 font-mono">"لا مزامنة"</strong> تعني أنه لم تكن هناك جلسة تحديث للبيانات مسجلة في ذلك الوقت المحدد، ويمكنك الضغط على زر المزامنة اليدوية لبدء الرصد للساعة الحالية.
            </span>
          </div>
        </div>

        {loadingHourly ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <RefreshCw className="w-8 h-8 text-[#6366f1] animate-spin" />
            <p className="text-xs text-[#a5a5c8]">جاري تجميع وحساب سحوبات المخازن بالساعات...</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
            {hourlyData.map((h) => {
              const isSelected = selectedHour24 === h.hour;
              const hasAnomalies = h.anomalies > 0;
              
              const displayVal = focusMetric === "events"
                ? (h.withdrawal_events || 0)
                : focusMetric === "products"
                ? (h.affected_products || 0)
                : h.quantity_decrease;

              const displayLabel = focusMetric === "events"
                ? "سحوبات"
                : focusMetric === "products"
                ? "سلع"
                : "قطع";

              const colorValue = focusMetric === "events"
                ? (h.withdrawal_events * 5)
                : focusMetric === "products"
                ? (h.affected_products * 5)
                : h.quantity_decrease;

              return (
                <button
                  key={h.hour}
                  onClick={() => setSelectedHour24(h.hour)}
                  title={h.hour_label}
                  className={`p-3 rounded-xl transition-all duration-200 text-center relative cursor-pointer flex flex-col justify-between h-24 ${getHeatmapColor(colorValue)} ${
                    isSelected ? "ring-2 ring-offset-2 ring-[#6366f1] ring-offset-[#0a0a1a] scale-105" : ""
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-[11px] font-black text-white tracking-tight">{formatShortCairoHour(h.hour)}</span>
                    
                    {/* Confidence or anomaly indicator dots */}
                    <div className="flex gap-1 items-center">
                      {hasAnomalies && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping absolute top-1 right-1" />
                      )}
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        h.confidence_level === 'HIGH' ? 'bg-[#24C78E]' :
                        h.confidence_level === 'MEDIUM' ? 'bg-[#F5A524]' :
                        h.confidence_level === 'LOW' ? 'bg-red-400' : 'bg-gray-500'
                      }`} title={`مستوى الثقة: ${h.confidence_level || 'غير محدد'}`} />
                    </div>
                  </div>

                  <div className="mt-2 flex-1 flex flex-col justify-center items-center">
                    {displayVal === null ? (
                      <span className="text-[10px] text-gray-500/80 font-bold block whitespace-nowrap">
                        {h.data_status === "NOT_SCHEDULED" ? "قريباً" : "لا مزامنة"}
                      </span>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <span className={`text-base font-mono font-extrabold tracking-tight block leading-none ${getHeatmapText(colorValue)}`}>
                          {displayVal.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-[#a5a5c8]/70 block font-sans mt-1 leading-none">{displayLabel}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Main 24-Hour Trend Chart & Dynamic Hour Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recharts Chart */}
        <div className="lg:col-span-2 bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg overflow-hidden relative">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <TrendingDown className="w-4.5 h-4.5 text-[#6366f1]" /> الرسم البياني التفاعلي لـ 24 ساعة
            </h3>
            <span className="text-[10px] text-[#a5a5c8] bg-[#1c1c47] px-2.5 py-1 rounded-md font-mono border border-[#2a2a5c]">
              التاريخ: {selectedDateStart}
            </span>
          </div>

          <div className="h-[340px] w-full" style={{ position: "relative" }}>
            {loadingHourly ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-8 h-8 text-[#6366f1] animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={hourlyData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorDecrease" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F05252" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#F05252" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProducts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#24C78E" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#24C78E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a5c/30" />
                  <XAxis 
                    dataKey="hour_label" 
                    stroke="#a5a5c8" 
                    fontSize={9} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#a5a5c8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#141432",
                      borderColor: "#2a2a5c",
                      color: "#fff",
                      textAlign: "right",
                      borderRadius: "12px",
                      fontSize: "11px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                    }}
                    itemStyle={{ color: "#f5f5fa" }}
                    labelStyle={{ fontWeight: "bold", color: "#6366f1", marginBottom: "4px" }}
                  />
                  <Area 
                    name={focusMetric === "events" ? "عمليات السحب" : focusMetric === "products" ? "السلع المتأثرة" : "القطع المسحوبة"}
                    type="monotone" 
                    dataKey={focusMetric === "events" ? "withdrawal_events" : focusMetric === "products" ? "affected_products" : "quantity_decrease"}
                    stroke={focusMetric === "events" ? "#6366f1" : focusMetric === "products" ? "#24C78E" : "#F05252"}
                    fillOpacity={1} 
                    fill={`url(#color${focusMetric === "events" ? "Events" : focusMetric === "products" ? "Products" : "Decrease"})`} 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Dynamic Hour Panel */}
        <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-[#2a2a5c]/40 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Clock className="w-4.5 h-4.5 text-[#F5A524]" /> {selectedHour24 === -1 ? "تفاصيل اليوم المحدد كاملاً" : "تفاصيل الساعة المحددة"}
                </h3>
                <p className="text-[10px] text-[#a5a5c8] mt-0.5">{selectedHour24 === -1 ? "مؤشرات الجودة والدقة والمنتجات الأكثر طلباً لليوم" : "مؤشرات الجودة والدقة والمنتجات الأكثر طلباً للساعة"}</p>
              </div>
              <span className="px-3 py-1 bg-[#F5A524]/10 text-[#F5A524] text-xs font-black rounded-lg">
                {selectedHour24 === -1 ? "تجميعي اليوم كامل" : formatCairoHourArabic(selectedHour24)}
              </span>
            </div>

            <div className="space-y-4 mt-4">
              <div className="bg-[#0a0a1a]/50 p-4 rounded-2xl border border-[#2a2a5c]/40 text-right">
                <span className="text-xs text-[#a5a5c8] block">{selectedHour24 === -1 ? "إجمالي سحوبات اليوم بالكامل" : "إجمالي سحوبات الساعة المحددة"}</span>
                <strong className="text-2xl font-mono text-[#F05252] block mt-1">
                  {selectedHour24 === -1 ? totalPiecesToday : (selectedHourDetails?.quantity_decrease || 0)} قطع
                </strong>
              </div>

              {/* Data Quality & Sync Stats */}
              <div className="bg-[#0a0a1a]/30 p-3.5 rounded-2xl border border-[#2a2a5c]/30 space-y-2.5 text-xs text-[#a5a5c8]">
                <div className="flex justify-between items-center">
                  <span>عمليات المزامنة الناجحة:</span>
                  <span className="text-white font-mono font-bold">
                    {selectedHour24 === -1 ? totalSyncsToday : (selectedHourDetails?.successful_syncs || 0)} مزامنة
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>عمليات الفشل أو الانقطاع:</span>
                  <span className="text-red-400 font-mono font-bold">
                    {selectedHour24 === -1 ? totalFailedSyncsToday : (selectedHourDetails?.failed_syncs || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>متوسط اكتمال رصد منصات التوريد:</span>
                  <span className={`font-mono font-bold ${
                    (selectedHour24 === -1 ? avgCompletenessToday : (selectedHourDetails?.data_completeness_percentage || 0)) === 100 ? "text-[#24C78E]" : "text-[#F5A524]"
                  }`}>
                    {selectedHour24 === -1 ? avgCompletenessToday : (selectedHourDetails?.data_completeness_percentage || 0)}% كاملة
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>مستوى ثقة القراءات الفعلي:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                    (selectedHour24 === -1 ? 'HIGH' : (selectedHourDetails?.confidence_level || 'LOW')) === 'HIGH' ? 'bg-[#24C78E]/10 text-[#24C78E]' :
                    (selectedHour24 === -1 ? 'HIGH' : (selectedHourDetails?.confidence_level || 'LOW')) === 'MEDIUM' ? 'bg-[#F5A524]/10 text-[#F5A524]' :
                    'bg-[#F05252]/10 text-[#F05252]'
                  }`}>
                    {selectedHour24 === -1 ? 'موثوقة للغاية (يومي)' :
                     selectedHourDetails?.confidence_level === 'HIGH' ? 'موثوقة للغاية' :
                     selectedHourDetails?.confidence_level === 'MEDIUM' ? 'ثقة متوسطة' :
                     'تغطية جزئية أو ضعيفة'}
                  </span>
                </div>
              </div>

              {/* Top performing info for the hour */}
              <div className="bg-[#1c1c47]/40 p-3.5 rounded-2xl border border-[#2a2a5c]/50 space-y-2 text-right">
                <span className="text-[9px] text-[#F5A524] font-black block">
                  {selectedHour24 === -1 ? "التفاصيل التجميعية لليوم المحدد" : "السلعة الرائدة بالسحب خلال هذه الساعة 👑"}
                </span>
                <p className="text-xs font-bold text-[#f5f5fa] truncate">
                  {selectedHour24 === -1 ? "معلومات مجمعة لجميع الساعات" : (selectedHourDetails?.highest_product_name || "لا يوجد مسحوبات مسجلة")}
                </p>
                <div className="flex justify-between text-[10px] text-[#a5a5c8] pt-1">
                  <span>{selectedHour24 === -1 ? "إجمالي العمليات:" : "التصنيف المكتسح:"} <strong className="text-white">{selectedHour24 === -1 ? `${totalEventsToday} سحب` : (selectedHourDetails?.highest_category || "غير معروف")}</strong></span>
                  <span>{selectedHour24 === -1 ? "الرصد بالتوقيت المحلي" : "المنصة:"} <strong className="text-white">{selectedHour24 === -1 ? "Cairo Time" : (selectedHourDetails?.highest_platform || "لا يوجد")}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-[#a5a5c8] bg-[#0a0a1a]/40 p-2.5 rounded-xl border border-dashed border-[#2a2a5c]/40 flex items-start gap-2 text-right mt-3">
            <Info className="w-4 h-4 text-[#6366f1] shrink-0 mt-0.5" />
            <p className="leading-normal">
              تحسب السحوبات بطرح كميات المنتجات الحالية من السحبة السابقة لنفس الساعة لتجنب التكرار.
            </p>
          </div>
        </div>
      </div>

      {/* Cairo 20-Minute Slot Analytics (فترات الـ 20 دقيقة فائقة الدقة) */}
      <div id="ten-minute-analytics" className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#6366f1]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2a2a5c]/40 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#6366f1]" /> مراقبة فترات الـ 20 دقيقة (ثلث الساعة)
            </h3>
            <p className="text-xs text-[#a5a5c8]">
              بيانات سحب المخزون مقسمة إلى فترات زمنية دقيقة كل 20 دقيقة.
            </p>
          </div>
          
          <div className="flex gap-2 shrink-0">
            <div className="bg-[#1c1c47] border border-[#2a2a5c] px-3.5 py-1.5 rounded-xl text-xs text-right">
              <span className="text-[10px] text-[#a5a5c8] block">إجمالي سحوبات الساعة</span>
              <strong className="text-sm font-mono text-[#F05252] font-black">{tenMinuteData?.summary.withdrawn_pieces ?? 0} قطع</strong>
            </div>
            <div className="bg-[#1c1c47] border border-[#2a2a5c] px-3.5 py-1.5 rounded-xl text-xs text-right">
              <span className="text-[10px] text-[#a5a5c8] block">الأحداث والعمليات</span>
              <strong className="text-sm font-mono text-[#6366f1] font-black">{tenMinuteData?.summary.withdrawal_events ?? 0} حدث سحب</strong>
            </div>
            <div className="bg-[#1c1c47] border border-[#2a2a5c] px-3.5 py-1.5 rounded-xl text-xs text-right">
              <span className="text-[10px] text-[#a5a5c8] block">السلع المتأثرة فعلياً</span>
              <strong className="text-sm font-mono text-[#24C78E] font-black">{tenMinuteData?.summary.affected_products ?? 0} سلع</strong>
            </div>
          </div>
        </div>

        {/* Mismatch Warning Alert */}
        {tenMinuteData && selectedHourDetails && tenMinuteData.summary.withdrawn_pieces !== selectedHourDetails.quantity_decrease && (
          <div className="bg-red-950/40 border border-red-500/40 p-4 rounded-2xl flex items-center gap-3 text-right text-red-400 text-xs">
            <Info className="w-5 h-5 shrink-0 text-red-500" />
            <div>
              <strong className="block font-black mb-0.5">تنبيه: تم رصد عدم تطابق في إجمالي السحوبات بالساعة المحددة!</strong>
              <span>
                إجمالي سحوبات الساعة بالمصفوفة ({selectedHourDetails.quantity_decrease} قطع) لا يتطابق مع مجموع فترات الـ 20 دقيقة ({tenMinuteData.summary.withdrawn_pieces} قطع). يرجى التحقق من دورات المزامنة أو تحديث الصفحة.
              </span>
            </div>
          </div>
        )}

        {loadingTenMinute ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="w-7 h-7 text-[#6366f1] animate-spin" />
            <p className="text-xs text-[#a5a5c8]">جاري تجميع أحداث فترات الـ 20 دقيقة الفورية...</p>
          </div>
        ) : !tenMinuteData ? (
          <div className="text-center py-12 text-xs text-[#a5a5c8]">
            الرجاء اختيار ساعة من المصفوفة العلوية لاستعراض فتراتها الدقيقة.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tenMinuteData.intervals.map((interval: any) => {
                const pieces = interval.withdrawn_pieces || 0;
                const events = interval.withdrawal_events || 0;
                
                const isSuccessAct = interval.dataStatus === "COMPLETED_WITH_ACTIVITY";
                const isCompleted = interval.dataStatus === "COMPLETED";
                const isSuccessZero = interval.dataStatus === "SUCCESS_ZERO";
                const isFailed = interval.dataStatus === "FAILED";
                const isPartial = interval.dataStatus === "PARTIAL";
                const isMissing = interval.dataStatus === "MISSING";
                const isNotSched = interval.dataStatus === "NOT_SCHEDULED";

                // Map Arabic status labels
                const getStatusLabel = () => {
                  if (interval.dataStatus === "SUCCESS_WITH_ACTIVITY") return "مكتملة مع سحب";
                  if (interval.dataStatus === "SUCCESS_ZERO") return "مكتملة (صفر سحب)";
                  if (interval.dataStatus === "PARTIAL") return "بيانات جزئية";
                  if (interval.dataStatus === "FAILED") return "فشل المزامنة";
                  if (interval.dataStatus === "MISSING") return "بيانات مفقودة";
                  if (interval.dataStatus === "CURRENT_INCOMPLETE") return "جاري المزامنة";
                  if (interval.dataStatus === "NOT_SCHEDULED") return "غير مجدولة";
                  return "غير معروف";
                };

                // Style based on status
                const getStatusStyleClass = () => {
                  if (interval.dataStatus === "SUCCESS_WITH_ACTIVITY") return "border-[#24C78E] bg-[#11241a]/90 text-[#24C78E] shadow-[0_0_15px_rgba(36,199,142,0.15)]";
                  if (interval.dataStatus === "SUCCESS_ZERO") return "border-[#a5a5c8] bg-[#1c1c47] text-[#a5a5c8]";
                  if (interval.dataStatus === "PARTIAL") return "border-[#F5A524] bg-[#553b11]/40 text-[#F5A524]";
                  if (interval.dataStatus === "FAILED") return "border-[#F05252] bg-[#59161a]/40 text-[#F05252]";
                  if (interval.dataStatus === "MISSING") return "border-[#555] bg-[#333]/40 text-gray-400";
                  if (interval.dataStatus === "CURRENT_INCOMPLETE") return "border-[#6366f1] bg-[#1c1c47] text-[#6366f1]";
                  return "border-[#2a2a5c] bg-[#1c1c47] text-[#a5a5c8]";
                };

                const pct = interval.dataCompletenessPercentage || 0;
                
                return (
                  <div 
                    key={interval.slot} 
                    className={`p-4 rounded-2xl border transition-all duration-200 text-right space-y-3.5 relative overflow-hidden ${getStatusStyleClass()}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black font-mono tracking-wide">{interval.intervalLabel}</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                        interval.dataStatus === "SUCCESS_WITH_ACTIVITY" ? "bg-[#24C78E]/10 text-[#24C78E]" :
                        interval.dataStatus === "SUCCESS_ZERO" ? "bg-[#1c1c47] text-[#a5a5c8]" :
                        "bg-gray-800 text-gray-400"
                      }`}>
                        {getStatusLabel()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-4 pt-1">
                      <div className="space-y-1 flex-1">
                        <div className="text-[11px] text-[#a5a5c8] flex justify-between">
                          <span>القطع المسحوبة:</span>
                          <strong className="text-white font-mono font-bold">
                            {interval.dataStatus === "MISSING" ? "بيانات مفقودة" : `${interval.withdrawnPieces} قطع`}
                          </strong>
                        </div>
                        <div className="text-[11px] text-[#a5a5c8] flex justify-between">
                          <span>السلع المتأثرة:</span>
                          <strong className="text-white font-mono font-bold">{interval.affectedProducts}</strong>
                        </div>
                        <div className="text-[11px] text-[#a5a5c8] flex justify-between">
                          <span>أحداث السحب:</span>
                          <strong className="text-white font-mono font-bold">{interval.withdrawalEvents}</strong>
                        </div>
                        <div className="text-[11px] text-[#a5a5c8] flex justify-between">
                          <span>حالة المزامنة:</span>
                          <strong className="text-emerald-400 font-mono font-bold">
                            {interval.syncRunsCount > 0 ? `تمت (${interval.syncRunsCount} مزامنة)` : "مكتملة (100%)"}
                          </strong>
                        </div>
                      </div>

                      {/* Gauge / Circular Indicator */}
                      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke="#1c1c47"
                            strokeWidth="3.5"
                            fill="transparent"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                             stroke={isSuccessAct || isCompleted ? "#24C78E" : "#a5a5c8"}
                            strokeWidth="3.5"
                            fill="transparent"
                            strokeDasharray={125.6}
                            strokeDashoffset={125.6 - (125.6 * pct) / 100}
                          />
                        </svg>
                        <span className="absolute text-[10px] font-black text-white font-mono">{pct}%</span>
                      </div>
                    </div>

                    {/* Timeline of earliest and latest events inside window */}
                    {(interval.firstEventAt || interval.lastEventAt) ? (
                      <div className="border-t border-[#2a2a5c]/40 pt-2.5 text-[9px] text-[#a5a5c8]/80 space-y-1">
                        {interval.firstEventAt && (
                          <div className="flex justify-between font-mono">
                            <span>أول حدث سحب:</span>
                            <span className="text-white font-bold">
                              {new Date(new Date(interval.firstEventAt).getTime() - 60 * 60 * 1000).toLocaleString("en-US", {
                                timeZone: "Africa/Cairo",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false
                              })}
                            </span>
                          </div>
                        )}
                        {interval.lastEventAt && interval.lastEventAt !== interval.firstEventAt && (
                          <div className="flex justify-between font-mono">
                            <span>آخر حدث سحب:</span>
                            <span className="text-white font-bold">
                              {new Date(new Date(interval.lastEventAt).getTime() - 60 * 60 * 1000).toLocaleString("en-US", {
                                timeZone: "Africa/Cairo",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-t border-[#2a2a5c]/20 pt-2.5 text-[9px] text-[#a5a5c8]/40 text-center font-bold">
                        {isNotSched ? "في انتظار تفعيل الفترة" : "لم يتم رصد أي عمليات سحب مخزني"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="bg-[#0a0a1a]/50 border border-[#2a2a5c]/30 p-3.5 rounded-2xl flex items-center gap-3.5 text-right">
              <Info className="w-5 h-5 text-[#6366f1] shrink-0" />
              <div className="text-[11px] text-[#a5a5c8] leading-relaxed">
                تقترن كل دورة مزامنة تتم بنجاح بفترتها المخصصة تلقائياً عبر مفتاح فريد يمنع تداخل القراءات أو الحساب المزدوج. إذا تكررت المزامنة لأي سبب، يقوم خادم الكواليس بتحديث الدورة القائمة وتجنب مكررات السحب تماماً.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Hourly KPI Cards section */}
      <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg">
        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 text-[#F5A524]" /> أداء ومؤشرات فترات الذروة المتكررة
        </h3>
        
        {loadingPeak ? (
          <div className="text-center py-6 text-xs text-[#a5a5c8]">جاري إجراء التقييمات التاريخية...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* KPI 1 */}
            <div className="bg-[#1c1c47]/60 p-4.5 rounded-2xl border border-[#2a2a5c]/40 flex items-start gap-3.5 text-right relative overflow-hidden">
              <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#a5a5c8] block font-bold">ساعة الذروة اليوم</span>
                <strong className="text-base text-white block">{peakAnalysis?.peakHourToday || "غير متوفر"}</strong>
                <span className="text-[10px] text-red-400 block font-semibold">سحبت {peakAnalysis?.peakHourTodayValue || 0} قطعة مخزون</span>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-[#1c1c47]/60 p-4.5 rounded-2xl border border-[#2a2a5c]/40 flex items-start gap-3.5 text-right relative overflow-hidden">
              <div className="p-3 rounded-xl bg-[#F5A524]/10 text-[#F5A524] shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#a5a5c8] block font-bold">متوسط الذروة الأسبوعي (7 أيام)</span>
                <strong className="text-base text-white block">{peakAnalysis?.highestAvgHour7Days || "غير متوفر"}</strong>
                <span className="text-[10px] text-[#24C78E] block font-semibold">بمتوسط {peakAnalysis?.highestAvgHour7DaysValue || 0} قطعة/ساعة</span>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-[#1c1c47]/60 p-4.5 rounded-2xl border border-[#2a2a5c]/40 flex items-start gap-3.5 text-right relative overflow-hidden">
              <div className="p-3 rounded-xl bg-[#6366f1]/10 text-[#6366f1] shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-[#a5a5c8] block font-bold">ساعة الذروة الأكثر تكراراً</span>
                <strong className="text-base text-white block">{peakAnalysis?.mostRepeatedPeakHour || "غير متوفر"}</strong>
                <span className="text-[10px] text-[#a5a5c8] block">تكررت كذروة في {peakAnalysis?.mostRepeatedPeakHourDays || 0} أيام هذا الأسبوع</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* 6. Active Products list for the selected hour */}
      <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#2a2a5c]/40 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-[#6366f1]" /> سجل تحركات كميات السلع الفردية بالساعة المحددة
            </h3>
            <p className="text-[10px] text-[#a5a5c8] mt-1">السلع التي طرأت عليها سحوبات أو توريدات إمداد خلال هذه الساعة المحددة.</p>
          </div>
          <span className="text-[10px] text-[#a5a5c8] bg-[#0a0a1a] border border-[#2a2a5c] px-3 py-1 rounded-md font-mono">
            {hourlyProducts.length} سلع تأثرت
          </span>
        </div>

        {loadingProducts ? (
          <div className="text-center py-12 text-xs text-[#a5a5c8]">جاري تحميل السلع وتجميع التحديثات الفورية...</div>
        ) : hourlyProducts.length === 0 ? (
          <div className="text-center py-16 text-xs text-[#a5a5c8] bg-[#0a0a1a]/20 rounded-2xl border border-dashed border-[#2a2a5c]/30 mt-4">
            {selectedHourDetails && selectedHourDetails.quantity_decrease > 0 ? (
              <div className="flex flex-col items-center justify-center space-y-2 text-[#24C78E] font-bold">
                <CheckCircle className="w-8 h-8 text-[#24C78E]" />
                <span className="text-sm text-white">تم رصد نشاط السحب لهذه الساعة وإدارته بنجاح ({selectedHourDetails.quantity_decrease} قطع). البيانات متزامنة ونشطة.</span>
                <span className="text-[10px] text-[#a5a5c8] font-normal">جميع السلع النشطة والمرتبطة تعمل بشكل سليم.</span>
              </div>
            ) : (
              "لا توجد سحوبات سلع فردية مرصودة حالياً خلال هذه الساعة المحددة."
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#2a2a5c]/30 text-[#a5a5c8] bg-[#0a0a1a]/30">
                  <th className="py-3 px-4 rounded-r-xl">السلعة</th>
                  <th className="py-3 px-4 font-mono">الـ SKU</th>
                  <th className="py-3 px-4">منصة التوريد</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4 text-center">الكمية السابقة</th>
                  <th className="py-3 px-4 text-center">الكمية الحالية</th>
                  <th className="py-3 px-4 text-center text-[#F05252] font-extrabold cursor-pointer hover:text-red-300" onClick={() => requestSort('quantity_decrease')}>
                    السحوبات {sortConfig.key === 'quantity_decrease' ? (sortConfig.direction === 'descending' ? '↓' : '↑') : ''}
                  </th>
                  <th className="py-3 px-4 text-center cursor-pointer hover:text-white" onClick={() => requestSort('restock_amount')}>
                    الإمدادات {sortConfig.key === 'restock_amount' ? (sortConfig.direction === 'descending' ? '↓' : '↑') : ''}
                  </th>
                  <th className="py-3 px-4 text-center rounded-l-xl">فحص السلعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a5c]/10">
                {sortedProducts.map((p, idx) => (
                  <tr key={p.product_id || p.id || `prod-${idx}`} className="hover:bg-[#1c1c47]/20 transition-all">
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2.5 max-w-xs">
                      {p.image_url ? (
                        <img 
                          src={p.image_url} 
                          alt={p.product_name || p.name || 'سلعة'} 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#2a2a5c]/60 bg-[#0a0a1a]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#1c1c47] border border-[#2a2a5c]/60 shrink-0 flex items-center justify-center font-mono text-[9px] text-[#a5a5c8]">
                          NO IMG
                        </div>
                      )}
                      <span className="truncate block font-semibold text-xs text-slate-100" title={p.product_name || p.name || 'غير معروف'}>{p.product_name || p.name || 'غير معروف'}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-300 select-all">{p.sku}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.platform === "safka" ? "bg-[#6366f1]/15 text-[#6366f1]" : "bg-[#F5A524]/15 text-[#F5A524]"
                      }`}>
                        {p.platform === "safka" ? "صفقة" : "تاجر"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#a5a5c8]">{p.category || 'غير مصنف'}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-gray-400">{p.previous_quantity}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-white">{p.current_quantity}</td>
                    <td className="py-3.5 px-4 text-center font-mono text-base font-extrabold text-[#F05252]">
                      {p.quantity_decrease > 0 ? `-${p.quantity_decrease}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-[#24C78E]">
                      {p.restock_amount > 0 ? `+${p.restock_amount}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={() => onProductClick({ id: p.product_id, name: p.product_name || p.name, sku: p.sku, imageUrl: p.image_url, platform: p.platform, originalCategory: p.category, currentQuantity: p.current_quantity } as any)}
                        className="p-1.5 rounded-lg bg-[#1c1c47] hover:bg-[#2a2a5c] text-[#6366f1] hover:text-white transition cursor-pointer"
                        title="عرض كلي للسلعة بالتحليلات العميقة"
                      >
                        <Eye className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Forecasts, Leaderboard & Streaks in Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Predictive High-Risk Inventory (Stockout prediction) */}
        <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-[#2a2a5c]/40 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Hourglass className="w-4.5 h-4.5 text-red-400" /> رادار التنبؤ بالنفاد المحتمل للسلع النشطة
                </h3>
                <p className="text-[10px] text-[#a5a5c8] mt-1">توقع ذكي ومبكر لساعات النفاد بناءً على معدلات السحب الموزونة بالأوزان النسبية.</p>
              </div>
            </div>

            {loadingRisk ? (
              <div className="text-center py-12 text-xs text-[#a5a5c8]">جاري معالجة معدلات السحب الحركية للتنبؤ...</div>
            ) : stockoutRisk.length === 0 ? (
              <div className="text-center py-16 text-xs text-[#a5a5c8] bg-[#0a0a1a]/20 rounded-2xl border border-dashed border-[#2a2a5c]/30 mt-4">
                جميع السلع النشطة بمعدل سحب هادئ أو مستقرة بالمستودعات.
              </div>
            ) : (
              <div className="space-y-3.5 mt-4 max-h-[350px] overflow-y-auto pr-1">
                {stockoutRisk.map((r) => {
                  const isCrit = r.riskLevel === "خطر حرج";
                  const isHigh = r.riskLevel === "خطر مرتفع";
                  return (
                    <div key={r.id} className="bg-[#0a0a1a]/50 border border-[#2a2a5c]/30 p-3.5 rounded-xl flex items-center justify-between text-right gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {r.imageUrl && (
                          <img 
                            src={r.imageUrl} 
                            alt={r.name} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#2a2a5c]/50 bg-[#0a0a1a]"
                          />
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-white block truncate">{r.name}</span>
                          <span className="text-[10px] text-[#a5a5c8] block font-mono">الكمية: {r.currentQuantity} قطعة | SKU: {r.sku}</span>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black inline-block mb-1.5 ${
                          isCrit ? "bg-red-500/15 text-red-400" :
                          isHigh ? "bg-orange-500/15 text-orange-400" :
                          "bg-[#F5A524]/10 text-[#F5A524]"
                        }`}>
                          {r.riskLevel}
                        </span>
                        <div className="text-xs text-white font-mono leading-none">
                          النفاد خلال <strong className="text-sm font-extrabold text-red-400">{r.estimatedHoursLeft} س</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Category leaderboards */}
        <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-[#2a2a5c]/40 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <TrendingDown className="w-4.5 h-4.5 text-[#24C78E]" /> تصنيفات الصدارة بسحب المخزون اليوم
                </h3>
                <p className="text-[10px] text-[#a5a5c8] mt-1">السلعة المتصدرة لمعدلات التناقص لكل تصنيف على حدة.</p>
              </div>
            </div>

            {loadingRisk ? (
              <div className="text-center py-12 text-xs text-[#a5a5c8]">جاري تحميل تصنيفات الصدارة...</div>
            ) : categoryLeaders.length === 0 ? (
              <div className="text-center py-16 text-xs text-[#a5a5c8] bg-[#0a0a1a]/20 rounded-2xl border border-dashed border-[#2a2a5c]/30 mt-4">
                لا توجد عمليات سحب مخزون مسجلة بالتصنيفات اليوم.
              </div>
            ) : (
              <div className="space-y-3 mt-4 max-h-[350px] overflow-y-auto pr-1">
                {categoryLeaders.map((c) => (
                  <div key={c.categoryName} className="bg-[#1c1c47]/40 border border-[#2a2a5c]/30 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#24C78E] font-black block">{c.categoryName}</span>
                      <strong className="text-xs text-white block truncate max-w-[200px] mt-0.5">{c.topProduct?.name || "لا يوجد"}</strong>
                      <span className="text-[10px] text-[#a5a5c8] block font-mono">القطع المسحوبة اليوم: {c.topProduct?.decrease || 0} قطع</span>
                    </div>

                    <div className="text-left">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        c.risk === "خطر حرج" ? "bg-red-500/15 text-red-400 animate-pulse" :
                        c.risk === "خطر مرتفع" ? "bg-orange-500/15 text-orange-400" :
                        "bg-[#24C78E]/10 text-[#24C78E]"
                      }`}>
                        {c.risk}
                      </span>
                      <div className="text-[10px] text-gray-400 mt-1 font-mono">مستوى الثقة: {c.confidence}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 8. Weekly Patterns & Continuous streaks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly activity Patterns Table */}
        <div className="lg:col-span-2 bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#2a2a5c]/40 pb-3 gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <Calendar className="w-4.5 h-4.5 text-[#6366f1]" /> خريطة كثافة النشاط وتوزيع سحوبات المخزون الأسبوعية
              </h3>
              <p className="text-[10px] text-[#a5a5c8] mt-1">تحديد الفروقات بين سلوك ومعدلات السحب اليومية لمختلف ساعات اليوم مقارنة بنهايات الأسبوع المحلية.</p>
            </div>
            
            {/* Toggle View Mode */}
            <div className="flex bg-[#1c1c47] p-0.5 rounded-xl border border-[#2a2a5c] text-xs shrink-0">
              <button
                onClick={() => setViewMode('heatmap')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${viewMode === 'heatmap' ? "bg-[#6366f1] text-white" : "text-[#a5a5c8] hover:text-white"}`}
              >
                <Activity className="w-3.5 h-3.5" /> خريطة الحرارة
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${viewMode === 'table' ? "bg-[#6366f1] text-white" : "text-[#a5a5c8] hover:text-white"}`}
              >
                <Calendar className="w-3.5 h-3.5" /> جدول الأنماط
              </button>
            </div>
          </div>

          {loadingWeekdays ? (
            <div className="text-center py-12 text-xs text-[#a5a5c8]">جاري تجميع أنماط الأسبوع...</div>
          ) : viewMode === 'heatmap' ? (
            <div className="space-y-4 pt-2">
              {/* Heatmap Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0a1a]/40 p-3 rounded-2xl border border-[#2a2a5c]/30 text-[10px] text-[#a5a5c8]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-white">دليل الكثافة (متوسط السحب بالقطعة):</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#112239]" /> صفر</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#1c4021]" /> خفيف (1-3)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#33501a]" /> متوسط (4-8)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#553b11]" /> مكثف (9-15)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#59161a]" /> انفجاري (16+)</span>
                  </div>
                </div>
                <div className="text-[9px] text-[#a5a5c8]/80">
                  💡 تلميحة: مرر الماوس فوق المربعات لعرض التفاصيل أو اضغط لتحديد الساعة واليوم.
                </div>
              </div>

              {/* Grid Wrapper with Horizontal Scroll for Mobile */}
              <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#2a2a5c] scrollbar-track-transparent">
                <div className="min-w-[800px] space-y-2 text-right" dir="rtl">
                  {/* Time Blocks Axis Legend Row */}
                  <div className="flex items-center text-[9px] font-sans font-bold pb-1 text-[#a5a5c8]">
                    <div className="w-20 shrink-0 text-right text-gray-400 font-sans">فترات اليوم</div>
                    <div className="flex-1 gap-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                      <div className="col-span-6 text-center bg-[#1c1c47]/60 py-1.5 rounded-lg border border-[#2a2a5c]/30 text-[#a5a5c8] flex items-center justify-center gap-1">
                        <span>🌙</span> <span className="hidden sm:inline">الليل والفجر</span> <span className="font-mono text-[8px] text-[#6366f1]">(0-5)</span>
                      </div>
                      <div className="col-span-6 text-center bg-blue-500/10 py-1.5 rounded-lg border border-[#6366f1]/20 text-blue-400 flex items-center justify-center gap-1">
                        <span>☀️</span> <span className="hidden sm:inline">الصباح</span> <span className="font-mono text-[8px] text-blue-300">(6-11)</span>
                      </div>
                      <div className="col-span-6 text-center bg-amber-500/10 py-1.5 rounded-lg border border-amber-500/20 text-amber-400 flex items-center justify-center gap-1">
                        <span>🌤️</span> <span className="hidden sm:inline">الظهيرة والعصر</span> <span className="font-mono text-[8px] text-amber-300">(12-17)</span>
                      </div>
                      <div className="col-span-6 text-center bg-indigo-500/10 py-1.5 rounded-lg border border-indigo-500/20 text-indigo-400 flex items-center justify-center gap-1">
                        <span>🌆</span> <span className="hidden sm:inline">المساء</span> <span className="font-mono text-[8px] text-indigo-300">(18-23)</span>
                      </div>
                    </div>
                  </div>

                  {/* Hours Header Row */}
                  <div className="flex items-center text-[10px] text-[#a5a5c8] font-mono font-bold border-b border-[#2a2a5c]/30 pb-2">
                    <div className="w-20 shrink-0 text-right font-sans">اليوم</div>
                    <div className="flex-1 gap-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} className="text-center" title={`${hour}:00`}>
                          {hour}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rows for each day */}
                  {weekdayPatterns.map((day) => {
                    const breakdown = day.hourlyBreakdown || [];
                    return (
                      <div key={day.dayName} className="flex items-center group py-1 hover:bg-[#1c1c47]/10 rounded-xl px-1 transition duration-100">
                        {/* Day Label */}
                        <div className="w-20 shrink-0 text-right text-xs font-black text-white group-hover:text-[#6366f1] transition">
                          {day.dayName}
                        </div>

                        {/* 24 Hour blocks */}
                        <div className="flex-1 gap-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                          {Array.from({ length: 24 }).map((_, hour) => {
                            const hourData = breakdown.find((b: any) => b.hour === hour) || { averageDecrease: 0 };
                            const avgDec = hourData.averageDecrease || 0;
                            
                            // Color logic
                            let cellBg = "bg-[#112239]";
                            let cellBorder = "border-transparent";
                            if (avgDec > 0 && avgDec <= 3) {
                              cellBg = "bg-[#1c4021]";
                            } else if (avgDec > 3 && avgDec <= 8) {
                              cellBg = "bg-[#33501a]";
                            } else if (avgDec > 8 && avgDec <= 15) {
                              cellBg = "bg-[#553b11]";
                            } else if (avgDec > 15) {
                              cellBg = "bg-[#59161a]";
                            }

                            // Active / selected style
                            const isCellSelected = selectedHeatmapCell?.dayName === day.dayName && selectedHeatmapCell?.hour === hour;
                            if (isCellSelected) {
                              cellBorder = "ring-2 ring-white ring-offset-1 ring-offset-[#0a0a1a] z-10 scale-110";
                            }

                            return (
                              <button
                                key={hour}
                                onClick={() => setSelectedHeatmapCell({
                                  dayName: day.dayName,
                                  hour,
                                  averageDecrease: avgDec,
                                  label: hourData.label || `${hour}:00`
                                })}
                                className={`h-7 rounded transition-all duration-150 relative group/cell cursor-pointer ${cellBg} ${cellBorder} border hover:scale-110 hover:z-10`}
                              >
                                {/* Mini Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0a0a1a] border border-[#2a2a5c] text-white text-[9px] font-sans p-2 rounded-lg shadow-2xl pointer-events-none opacity-0 group-hover/cell:opacity-100 transition duration-150 whitespace-nowrap z-50">
                                  <div className="font-bold text-[#6366f1]">{day.dayName} — {hourData.label || `${hour}:00`}</div>
                                  <div className="text-gray-300 mt-0.5">متوسط السحوبات: <span className="font-mono text-white font-extrabold">{avgDec}</span> قطعة</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Heatmap Cell Detail View */}
              {selectedHeatmapCell ? (
                <div className="bg-[#0a0a1a]/60 p-4 rounded-2xl border border-[#2a2a5c]/40 text-right space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-[#2a2a5c]/30 pb-2">
                    <span className="text-xs text-[#a5a5c8]">تفاصيل النقطة المحددة في خريطة الحرارة</span>
                    <button 
                      onClick={() => setSelectedHeatmapCell(null)}
                      className="text-[10px] text-[#a5a5c8] hover:text-white px-2 py-0.5 rounded bg-[#1c1c47] hover:bg-red-950/40 border border-[#2a2a5c] transition cursor-pointer"
                    >
                      إغلاق التفاصيل ×
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#141432]/60 p-3 rounded-xl border border-[#2a2a5c]/20">
                      <span className="text-[10px] text-[#a5a5c8] block">اليوم المحدد</span>
                      <strong className="text-sm text-white block mt-1">{selectedHeatmapCell.dayName}</strong>
                    </div>
                    
                    <div className="bg-[#141432]/60 p-3 rounded-xl border border-[#2a2a5c]/20">
                      <span className="text-[10px] text-[#a5a5c8] block">الساعة والوقت</span>
                      <strong className="text-sm text-[#6366f1] block mt-1">{selectedHeatmapCell.label}</strong>
                    </div>

                    <div className="bg-[#141432]/60 p-3 rounded-xl border border-[#2a2a5c]/20">
                      <span className="text-[10px] text-[#a5a5c8] block">متوسط كثافة التناقص والمغادرة</span>
                      <strong className={`text-sm block mt-1 ${
                        selectedHeatmapCell.averageDecrease === 0 ? "text-gray-500" :
                        selectedHeatmapCell.averageDecrease <= 3 ? "text-[#24C78E]" :
                        selectedHeatmapCell.averageDecrease <= 8 ? "text-[#F5A524]" : "text-red-400 font-black"
                      }`}>{selectedHeatmapCell.averageDecrease} قطع / ساعة</strong>
                    </div>
                  </div>

                  <div className="text-xs text-[#a5a5c8] leading-relaxed flex items-start gap-2 bg-[#6366f1]/5 p-3 rounded-xl border border-[#6366f1]/10 mt-2">
                    <span className="text-base">💡</span>
                    <div>
                      <span className="font-extrabold text-[#6366f1] block mb-1">الرؤية التشغيلية المستخلصة:</span>
                      {selectedHeatmapCell.averageDecrease === 0 ? (
                        <span>لا تسجل هذه الفترة أي سحوبات في العادة. يمكن جدولة أعمال الجرد أو الصيانة خلال هذه الساعة لعدم التأثير على العمليات الحيوية.</span>
                      ) : selectedHeatmapCell.averageDecrease <= 3 ? (
                        <span>الحركة طبيعية خفيفة ومستقرة. مستويات الأمان كافية لتغطية هذه الساعة بشكل مريح دون الحاجة لخطوات وقائية مستعجلة.</span>
                      ) : selectedHeatmapCell.averageDecrease <= 8 ? (
                        <span>حركة مغادرة متوسطة إلى نشطة. يُنصح بالتأكد من مراجعة جودة قراءة المخزون وتفادي الإشغالات اللوجستية قبل بداية هذه الساعة بساعة واحدة.</span>
                      ) : (
                        <span>انتباه! ذروة تشغيلية وحجم مبيعات/تناقص مخزون انفجاري. يجب على منسقي الفروع وأمناء المخازن توفير تغذية مسبقة وإعداد خطوط العمل لمواجهة حركة السحب السريعة لتفادي نفاد السلع المفاجئ.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-[#0a0a1a]/20 rounded-2xl border border-dashed border-[#2a2a5c]/20 text-[10px] text-[#a5a5c8]">
                  اضغط على أي مربع لوني في الخريطة لاستخراج الرؤى اللوجستية وتوقعات الذروة المباشرة لتلك الساعة.
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a5c]/30 text-[#a5a5c8] bg-[#0a0a1a]/20">
                    <th className="py-2.5 px-3 rounded-r-xl">اليوم</th>
                    <th className="py-2.5 px-3 text-center">متوسط التناقص اليومي</th>
                    <th className="py-2.5 px-3 text-center">متوسط السلع المتأثرة</th>
                    <th className="py-2.5 px-3 text-center">ساعة ذروة اليوم</th>
                    <th className="py-2.5 px-3 text-center rounded-l-xl">الأيام المسجلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a5c]/10">
                  {weekdayPatterns.map((day) => (
                    <tr key={day.dayName} className="hover:bg-[#1c1c47]/10">
                      <td className="py-3 px-3 text-white font-extrabold">{day.dayName}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-red-400">{day.averageDecrease} قطع</td>
                      <td className="py-3 px-3 text-center font-mono text-gray-300">{day.averageAffectedProducts} سلع</td>
                      <td className="py-3 px-3 text-center text-[#F5A524] font-bold">{day.mostActiveHour}</td>
                      <td className="py-3 px-3 text-center font-mono text-gray-500">{day.sampleDays} يوم</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Multi-hour streaks */}
        <div className="bg-[#141432] border border-[#2a2a5c] p-6 rounded-3xl space-y-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b border-[#2a2a5c]/40 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <Activity className="w-4.5 h-4.5 text-[#F5A524]" /> المنتجات ذات السحوبات المتتالية (اليوم)
                </h3>
                <p className="text-[10px] text-[#a5a5c8] mt-1">السلع التي تستقبل طلبات وسحوبات نشطة ومستمرة عبر ساعات متتالية متقاطعة.</p>
              </div>
            </div>

            {loadingRisk ? (
              <div className="text-center py-12 text-xs text-[#a5a5c8]">جاري تتبع السلاسل الزمنية المتتالية...</div>
            ) : multiHourLeaders.length === 0 ? (
              <div className="text-center py-16 text-xs text-[#a5a5c8] bg-[#0a0a1a]/20 rounded-2xl border border-dashed border-[#2a2a5c]/30 mt-4">
                لا توجد سلع بسحوبات متتالية مسجلة لليوم.
              </div>
            ) : (
              <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto pr-1">
                {multiHourLeaders.map((l) => (
                  <div key={l.id} className="bg-[#1c1c47]/40 border border-[#2a2a5c]/30 p-3 rounded-xl flex items-center justify-between text-right gap-2">
                    <div className="min-w-0 flex-1">
                      <strong className="text-xs text-white block truncate">{l.name}</strong>
                      <span className="text-[9px] text-[#a5a5c8] block font-mono">سحبت عبر {l.hoursCount} ساعات مختلفة اليوم</span>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-[#F5A524]/10 text-[#F5A524] block mb-1">
                        {l.consecutiveHours}س متتالية ⏱️
                      </span>
                      <span className="text-[9px] text-red-400 font-bold block">{l.totalDecrease} قطع</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
