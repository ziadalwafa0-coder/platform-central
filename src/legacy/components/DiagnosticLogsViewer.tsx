// @ts-nocheck
import React, { useEffect, useState } from "react";
import { safeFetchJson } from "../lib/api";
import { 
  Terminal, 
  RefreshCw, 
  CircleCheck, 
  CircleX, 
  TriangleAlert, 
  Activity, 
  Database, 
  Info, 
  Clock, 
  CloudLightning,
  TrendingDown,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Server,
  Timer,
  Gauge
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const success = payload.find((p: any) => p.dataKey === "success")?.value ?? 0;
    const failed = payload.find((p: any) => p.dataKey === "failed")?.value ?? 0;
    const rate = payload.find((p: any) => p.dataKey === "successRate")?.value ?? 100;
    
    return (
      <div className="bg-[#12233A] border border-[#20324A] p-3.5 rounded-2xl text-[11px] text-[#F4F7FB] shadow-2xl text-right min-w-[200px] space-y-2">
        <div className="font-bold border-b border-[#20324A]/50 pb-2 text-[#2F80FF]">
          التاريخ: {label}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9FB0C5]">مزامنات ناجحة:</span>
          <strong className="text-[#24C78E] font-mono">{success}</strong>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9FB0C5]">مزامنات فاشلة:</span>
          <strong className="text-[#F05252] font-mono">{failed}</strong>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9FB0C5]">إجمالي المحاولات:</span>
          <strong className="text-white font-mono">{Number(success) + Number(failed)}</strong>
        </div>
        <div className="flex justify-between items-center border-t border-[#20324A]/30 pt-1.5">
          <span className="text-[#9FB0C5]">نسبة الاستقرار:</span>
          <strong className="text-[#2F80FF] font-mono">{rate}%</strong>
        </div>
      </div>
    );
  }
  return null;
};

const LatencyTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    const durationSec = (item.durationMs / 1000).toFixed(2);
    
    // For individual runs
    if (item.id) {
      return (
        <div className="bg-[#12233A] border border-[#20324A] p-3.5 rounded-2xl text-[11px] text-[#F4F7FB] shadow-2xl text-right min-w-[220px] space-y-2">
          <div className="font-bold border-b border-[#20324A]/50 pb-2 text-[#24C78E] flex justify-between items-center gap-2">
            <span>دورة مزامنة {item.indexLabel}</span>
            <span className="text-[9px] text-[#9FB0C5] font-mono">{item.id.substring(0, 8)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#9FB0C5]">المنصة:</span>
            <strong className="text-white font-sans">{item.platform === "safka" ? "منصة صفقة" : item.platform}</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#9FB0C5]">زمن المعالجة:</span>
            <strong className="text-[#24C78E] font-mono">{durationSec} ثانية ({item.durationMs.toLocaleString()} ms)</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#9FB0C5]">المنتجات المستلمة:</span>
            <strong className="text-white font-mono">{item.productsReceived}</strong>
          </div>
          <div className="flex justify-between items-center border-t border-[#20324A]/30 pt-1.5">
            <span className="text-[#9FB0C5]">توقيت البدء:</span>
            <span className="text-white font-mono text-[9px]">{item.formattedTime}</span>
          </div>
        </div>
      );
    }
    
    // For daily averages
    return (
      <div className="bg-[#12233A] border border-[#20324A] p-3.5 rounded-2xl text-[11px] text-[#F4F7FB] shadow-2xl text-right min-w-[220px] space-y-2">
        <div className="font-bold border-b border-[#20324A]/50 pb-2 text-[#2F80FF]">
          التاريخ: {item.formattedDate}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9FB0C5]">متوسط زمن المعالجة:</span>
          <strong className="text-[#24C78E] font-mono">{(item.avgDurationMs / 1000).toFixed(2)} ثانية</strong>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9FB0C5]">ملي ثانية:</span>
          <strong className="text-[#2F80FF] font-mono">{item.avgDurationMs.toLocaleString()} ms</strong>
        </div>
        <div className="flex justify-between items-center border-t border-[#20324A]/30 pt-1.5">
          <span className="text-[#9FB0C5]">المزامنات الناجحة اليوم:</span>
          <strong className="text-white font-mono">{item.count}</strong>
        </div>
      </div>
    );
  }
  return null;
};

interface SyncRunLog {
  id: string;
  platform: string;
  status: "CONNECTING" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  pagesRequested: number;
  pagesCompleted: number;
  productsReceived: number;
  productsUpdated: number;
  snapshotsCreated: number;
  productsSkipped: number;
  restocksDetected: number;
  quantityDecreasesDetected: number;
  retryCount: number;
  errors: any[];
  errorSummary?: string | null;
  createdAt: string;
}

interface DiagnosticData {
  success: boolean;
  logs: SyncRunLog[];
  thirtyDaysStats?: {
    dateStr: string;
    success: number;
    failed: number;
    total: number;
    successRate: number;
  }[];
  successfulRunsLatency30Days?: {
    id: string;
    platform: string;
    startedAt: string;
    durationMs: number;
    productsReceived: number;
  }[];
  summary: {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    processingRuns: number;
    totalProductsReceived: number;
    totalSnapshotsCreated: number;
    totalDecreasesDetected: number;
  };
  diagnostics: {
    activeSyncProgress: {
      syncing: boolean;
      processedCount: number;
      totalProducts: number;
      statusText: string;
      lastError: string | null;
      lastErrorPlatform: string | null;
    };
    isSupabaseConfigured: boolean;
    dataBackend: string;
    nodeEnv: string;
    serverTimeUtc: string;
    serverTimeCairo: {
      dateStr: string;
      hour: number;
      minute: number;
    };
    totalProductsInDb: number;
    totalSnapshotsInDb: number;
    systemInsight: string;
  };
}

export default function DiagnosticLogsViewer() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "completed" | "failed" | "processing">("all");
  const [latencyViewMode, setLatencyViewMode] = useState<"individual" | "daily">("individual");
  const [latencyLimit, setLatencyLimit] = useState<number>(30);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await safeFetchJson<any>("/api/sync/logs");
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || "Unknown diagnostic error");
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatTimeArabic = (isoString: string | undefined) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("ar-EG", {
        timeZone: "Africa/Cairo",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  const getDurationText = (start: string | undefined, end: string | null | undefined) => {
    if (!start || !end) return "--";
    try {
      const ms = new Date(end).getTime() - new Date(start).getTime();
      return `${(ms / 1000).toFixed(1)} ثانية`;
    } catch {
      return "--";
    }
  };

  const getDailyAverageLatency = () => {
    if (!data?.successfulRunsLatency30Days) return [];
    
    const groups: { [dateStr: string]: { totalMs: number; count: number } } = {};
    for (const r of data.successfulRunsLatency30Days) {
      try {
        const dateStr = r.startedAt.substring(0, 10);
        if (!groups[dateStr]) {
          groups[dateStr] = { totalMs: 0, count: 0 };
        }
        groups[dateStr].totalMs += r.durationMs;
        groups[dateStr].count++;
      } catch {}
    }
    
    const todayDate = new Date();
    const statsList = [];
    for (let i = 29; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setDate(todayDate.getDate() - i);
      const dateStr = targetDate.toISOString().substring(0, 10);
      const group = groups[dateStr];
      
      let formattedDate = dateStr;
      try {
        const [_, m, d] = dateStr.split("-");
        const monthsArabic = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const idx = parseInt(m) - 1;
        formattedDate = `${parseInt(d)} ${monthsArabic[idx] || m}`;
      } catch {}

      statsList.push({
        dateStr,
        formattedDate,
        avgDurationMs: group && group.count > 0 ? Math.round(group.totalMs / group.count) : 0,
        count: group ? group.count : 0
      });
    }
    return statsList;
  };

  const getIndividualRunsData = () => {
    if (!data?.successfulRunsLatency30Days) return [];
    const rawList = data.successfulRunsLatency30Days;
    const sliced = rawList.slice(-latencyLimit);
    return sliced.map((r, index) => {
      let formattedTime = "";
      try {
        const d = new Date(r.startedAt);
        formattedTime = d.toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Cairo"
        }) + " " + d.toLocaleDateString("ar-EG", {
          month: "short",
          day: "numeric",
          timeZone: "Africa/Cairo"
        });
      } catch {
        formattedTime = r.startedAt;
      }

      return {
        ...r,
        indexLabel: `#${rawList.length - sliced.length + index + 1}`,
        formattedTime,
        durationMs: r.durationMs
      };
    });
  };

  const filteredLogs = data?.logs.filter(log => {
    if (filter === "all") return true;
    if (filter === "completed") return log.status === "COMPLETED";
    if (filter === "failed") return log.status === "FAILED";
    if (filter === "processing") return log.status === "PROCESSING" || log.status === "CONNECTING";
    return true;
  }) || [];

  return (
    <div className="space-y-6 text-right">
      
      {/* Header and Refresh Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2.5 justify-start">
            <Terminal className="w-5.5 h-5.5 text-[#2F80FF]" />
            مركز التحليلات التشخيصية ومعالجة البيانات (Diagnostic Logs)
          </h2>
          <p className="text-[11px] text-[#9FB0C5] mt-1">
            مستكشف تقني تفصيلي لعمليات سحب المخزون، مطابقة البيانات، والاتصال بالخادم لمساعدتك على معرفة أسباب عدم ظهور أي نقاط سحب.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2 bg-[#12233A] hover:bg-[#20324A] border border-[#20324A] text-xs font-bold text-white rounded-xl transition cursor-pointer flex items-center gap-2 self-end sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#2F80FF]" : "text-white"}`} />
          <span>تحديث السجلات</span>
        </button>
      </div>

      {loading && !data ? (
        <div className="bg-[#0D1B2D] border border-[#20324A] p-12 rounded-3xl text-center space-y-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[#2F80FF] mx-auto" />
          <p className="text-xs text-[#9FB0C5]">جاري تحميل السجلات والبيانات التشخيصية من الخادم...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-center space-y-3">
          <CircleX className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">فشل الاتصال بمركز التشخيص</h3>
          <p className="text-xs text-[#9FB0C5] max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-xs font-bold text-white rounded-xl transition"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : data ? (
        <>
          {/* 1. Automated System Insight (Smart AI Help Alert) */}
          <div className="bg-[#12233A]/60 border border-[#20324A] p-5 rounded-3xl space-y-3.5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F80FF]"></div>
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-[#2F80FF] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-xs font-extrabold text-[#F4F7FB]">تحليل الرادار التلقائي (System Health & Insights):</h3>
                <p className="text-xs text-white leading-relaxed font-semibold">
                  {data.diagnostics.systemInsight}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Diagnostic Summary Statistics Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-2xl text-right">
              <span className="text-[10px] text-[#9FB0C5] block">إجمالي عمليات الفحص</span>
              <strong className="text-lg font-black text-white block mt-1 font-mono">{data.summary.totalRuns}</strong>
              <span className="text-[9px] text-[#9FB0C5] block mt-1">
                <span className="text-emerald-400 font-bold">{data.summary.successRuns} ناجح</span>
                {" • "}
                <span className="text-red-400 font-bold">{data.summary.failedRuns} فشل</span>
              </span>
            </div>

            <div className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-2xl text-right">
              <span className="text-[10px] text-[#9FB0C5] block">إجمالي المنتجات المستلمة</span>
              <strong className="text-lg font-black text-[#2F80FF] block mt-1 font-mono">{data.summary.totalProductsReceived.toLocaleString("en-US")}</strong>
              <span className="text-[9px] text-[#9FB0C5] block mt-1">منتج تم فحصه ومطابقته</span>
            </div>

            <div className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-2xl text-right">
              <span className="text-[10px] text-[#9FB0C5] block">لقطات التغيير المنشأة</span>
              <strong className="text-lg font-black text-emerald-400 block mt-1 font-mono">{data.summary.totalSnapshotsCreated.toLocaleString("en-US")}</strong>
              <span className="text-[9px] text-[#9FB0C5] block mt-1">سجل لقطات التغير التاريخية</span>
            </div>

            <div className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-2xl text-right">
              <span className="text-[10px] text-[#9FB0C5] block">عمليات السحب المرصودة</span>
              <strong className="text-lg font-black text-red-400 block mt-1 font-mono">{data.summary.totalDecreasesDetected.toLocaleString("en-US")}</strong>
              <span className="text-[9px] text-[#9FB0C5] block mt-1">سحوبات قطع حقيقية اليوم</span>
            </div>
          </div>

          {/* Data Integrity Reconciliation Section */}
          <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6">
            <div className="border-b border-[#20324A]/60 pb-4">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#2F80FF]" />
                سلامة ومطابقة البيانات ومطابقة السجلات (Data Integrity Reconciliation)
              </h3>
              <p className="text-[10px] text-[#9FB0C5] mt-1">
                نظام فحص تلقائي لمطابقة كمية السجلات الواردة عبر الـ API مع السجلات الفعلية التي تم حفظها في قاعدة البيانات لضمان كفاءة وشفافية عمليات الرصد.
              </p>
            </div>

            {(() => {
              const completedRuns = data.logs.filter(log => log.status === "COMPLETED" || log.status === "PARTIALLY_COMPLETED");
              const latestRun = completedRuns[0];
              
              let totalApiCount = 0;
              let totalDbCount = 0;
              let discrepancyRunsCount = 0;
              
              completedRuns.forEach(run => {
                const received = run.productsReceived || 0;
                const saved = run.productsUpdated || 0;
                totalApiCount += received;
                totalDbCount += saved;
                if (received !== saved) {
                  discrepancyRunsCount++;
                }
              });

              const globalMatchRate = totalApiCount > 0 ? ((totalDbCount / totalApiCount) * 100).toFixed(2) : "100";
              const hasDiscrepancy = discrepancyRunsCount > 0;

              return (
                <div className="space-y-6">
                  {/* Summary Status Alert */}
                  <div className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                    hasDiscrepancy 
                      ? "bg-[#F05252]/5 border-[#F05252]/20 text-red-100" 
                      : "bg-[#24C78E]/5 border-[#24C78E]/20 text-emerald-100"
                  }`}>
                    <div className="flex items-start gap-3.5">
                      {hasDiscrepancy ? (
                        <TriangleAlert className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldCheck className="w-6 h-6 text-[#24C78E] shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 text-right">
                        <h4 className="text-xs font-black text-white">
                          {hasDiscrepancy 
                            ? "تنبيه: تم رصد فروقات غير متطابقة في بعض دورات المزامنة الأخيرة" 
                            : "حالة تكامل البيانات: سليمة ومطابقة بنسبة 100%"}
                        </h4>
                        <p className="text-[11px] text-[#9FB0C5] leading-relaxed">
                          {hasDiscrepancy 
                            ? `من بين آخر ${completedRuns.length} دورات مزامنة، وجدنا عدد ${discrepancyRunsCount} دورات تحتوي على تفاوت بين السجلات المستلمة والمسجلة فعلياً. إجمالي الفارق التراكمي هو ${totalApiCount - totalDbCount} سجل.`
                            : "تمت مطابقة جميع المنتجات الواردة من مزودي الكتالوج بنجاح مع السجلات المحفوظة في قاعدة البيانات (Supabase/Local). لا توجد سجلات مفقودة أو مهملة في عمليات المزامنة."}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-[#9FB0C5] block">معدل تكامل البيانات العام</span>
                      <strong className={`text-xl font-black font-mono mt-1 ${
                        hasDiscrepancy ? "text-amber-400" : "text-[#24C78E]"
                      }`}>
                        {globalMatchRate}%
                      </strong>
                    </div>
                  </div>

                  {/* Latest Sync Detail Reconciliation Card */}
                  {latestRun && (
                    <div className="bg-[#07111F] border border-[#20324A]/40 p-5 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center border-b border-[#20324A]/30 pb-3">
                        <span className="font-extrabold text-white text-xs block">مقارنة وتدقيق الدورة الأخيرة (#{latestRun.id.substring(0, 8)})</span>
                        <span className="text-[10px] text-[#9FB0C5] font-mono">{formatTimeArabic(latestRun.completedAt || latestRun.startedAt)}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* API Count card */}
                        <div className="bg-[#12233A]/50 border border-[#20324A]/30 p-4 rounded-xl text-right">
                          <span className="text-[10px] text-[#9FB0C5] block flex items-center gap-1.5 justify-end">
                            <span>السجلات المجلوبة من الـ API</span>
                            <Server className="w-3.5 h-3.5 text-[#2F80FF]" />
                          </span>
                          <strong className="text-base font-black text-white block mt-1 font-mono">
                            {latestRun.productsReceived} <span className="text-[10px] font-sans text-[#9FB0C5]">منتج</span>
                          </strong>
                        </div>

                        {/* Database Count card */}
                        <div className="bg-[#12233A]/50 border border-[#20324A]/30 p-4 rounded-xl text-right">
                          <span className="text-[10px] text-[#9FB0C5] block flex items-center gap-1.5 justify-end">
                            <span>السجلات المحفوظة بالكامل</span>
                            <Database className="w-3.5 h-3.5 text-[#24C78E]" />
                          </span>
                          <strong className="text-base font-black text-white block mt-1 font-mono">
                            {latestRun.productsUpdated} <span className="text-[10px] font-sans text-[#9FB0C5]">منتج</span>
                          </strong>
                        </div>

                        {/* Discrepancy card */}
                        {(() => {
                          const diff = (latestRun.productsReceived || 0) - (latestRun.productsUpdated || 0);
                          const isDiscrepant = diff !== 0;
                          return (
                            <div className={`border p-4 rounded-xl text-right ${
                              isDiscrepant 
                                ? "bg-[#F05252]/10 border-[#F05252]/20" 
                                : "bg-[#24C78E]/10 border-[#24C78E]/20"
                            }`}>
                              <span className="text-[10px] text-[#9FB0C5] block flex items-center gap-1.5 justify-end">
                                <span>الفروقات أو السجلات المستبعدة</span>
                                {isDiscrepant ? (
                                  <TriangleAlert className="w-3.5 h-3.5 text-red-400" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#24C78E]" />
                                )}
                              </span>
                              <strong className={`text-base font-black block mt-1 font-mono ${
                                isDiscrepant ? "text-red-400" : "text-[#24C78E]"
                              }`}>
                                {isDiscrepant ? `${diff} منتج` : "0 (مطابقة تامة)"}
                              </strong>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Explanation box for discrepancies in latest run */}
                      {((latestRun.productsReceived || 0) - (latestRun.productsUpdated || 0)) !== 0 && (
                        <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2 text-right">
                          <div className="text-xs font-black text-amber-400 flex items-center gap-1.5 justify-end">
                            <span>💡 أسباب محتملة لوجود هذا التفاوت في الدورة الأخيرة</span>
                            <Info className="w-3.5 h-3.5" />
                          </div>
                          <p className="text-[10px] text-[#9FB0C5] leading-relaxed">
                            وجود فارق بين المنتجات المجلوبة من الـ API والمنتجات المحدثة يحدث عادة بسبب:
                          </p>
                          <ul className="text-[10px] text-[#9FB0C5] space-y-1 list-disc list-inside">
                            <li><strong>تكرار المعرف الفريد (Duplicate IDs):</strong> يحتوي كتالوج المورد على منتجات مكررة تم دمجها برمجياً لضمان عدم حدوث تضارب في البيانات.</li>
                            <li><strong>استبعاد سجلات غير صالحة:</strong> يقوم التطبيق تلقائياً بتجاوز أي منتج لا يحتوي على سعر صالح أو اسم لضمان سلامة واستقرار التقارير.</li>
                            <li><strong>توقف المزامنة أو انقطاع الشبكة:</strong> حدوث انقطاع مؤقت أثناء إرسال البيانات إلى السحابة.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Sync success/fail rate over last 30 days graph */}
          {data.thirtyDaysStats && data.thirtyDaysStats.length > 0 && (
            <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#20324A]/50 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 justify-start">
                    <Activity className="w-4.5 h-4.5 text-[#2F80FF]" />
                    استقرار ومعدلات نجاح عمليات المزامنة (آخر 30 يوماً)
                  </h3>
                  <p className="text-[10px] text-[#9FB0C5] mt-1">
                    رصد بياني لمعدل نجاح وفشل عمليات المزامنة يومياً ونسبة استقرار الخادم للربط بقنوات التوريد
                  </p>
                </div>
                
                {/* Custom Legend */}
                <div className="flex items-center gap-4 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-[#24C78E]"></span>
                    <span className="text-[#9FB0C5]">ناجحة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-[#F05252]"></span>
                    <span className="text-[#9FB0C5]">فاشلة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-[#2F80FF] relative flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2F80FF]"></span>
                    </span>
                    <span className="text-[#9FB0C5]">نسبة الاستقرار %</span>
                  </div>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.thirtyDaysStats.map(item => ({
                      ...item,
                      formattedDate: (() => {
                        try {
                          const [_, m, d] = item.dateStr.split("-");
                          const monthsArabic = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
                          const idx = parseInt(m) - 1;
                          return `${parseInt(d)} ${monthsArabic[idx] || m}`;
                        } catch {
                          return item.dateStr;
                        }
                      })()
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#20324A" opacity={0.15} vertical={false} />
                    <XAxis 
                      dataKey="formattedDate" 
                      stroke="#9FB0C5" 
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#9FB0C5" 
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#2F80FF" 
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Stacked Bars for success/fail volumes */}
                    <Bar 
                      yAxisId="left" 
                      dataKey="success" 
                      stackId="a" 
                      fill="#24C78E" 
                      radius={[0, 0, 4, 4]} 
                      maxBarSize={16} 
                    />
                    <Bar 
                      yAxisId="left" 
                      dataKey="failed" 
                      stackId="a" 
                      fill="#F05252" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={16} 
                    />
                    
                    {/* Stability percentage line */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="successRate"
                      stroke="#2F80FF"
                      strokeWidth={2}
                      dot={{ fill: "#2F80FF", r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Latency & Duration trends over last 30 days chart */}
          {data.successfulRunsLatency30Days && data.successfulRunsLatency30Days.length > 0 && (
            <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-5">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#20324A]/50 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 justify-start">
                    <Timer className="w-4.5 h-4.5 text-[#24C78E]" />
                    تحليل زمن المعالجة وفترات الاستجابة للمزامنة (Latency Trends)
                  </h3>
                  <p className="text-[10px] text-[#9FB0C5] mt-1">
                    رصد بياني لزمن الاستجابة لتحديد قنوات التوريد الأكثر كفاءة ومراقبة مستويات تأخر خوادم المزامنة
                  </p>
                </div>

                {/* View Mode Controllers & Limits */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="bg-[#07111F] p-0.5 rounded-xl border border-[#20324A] flex">
                    <button
                      type="button"
                      onClick={() => setLatencyViewMode("individual")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                        latencyViewMode === "individual"
                          ? "bg-[#24C78E] text-[#07111F]"
                          : "text-[#9FB0C5] hover:text-white"
                      }`}
                    >
                      دورات فردية
                    </button>
                    <button
                      type="button"
                      onClick={() => setLatencyViewMode("daily")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                        latencyViewMode === "daily"
                          ? "bg-[#24C78E] text-[#07111F]"
                          : "text-[#9FB0C5] hover:text-white"
                      }`}
                    >
                      المتوسط اليومي
                    </button>
                  </div>

                  {latencyViewMode === "individual" && (
                    <div className="bg-[#07111F] p-0.5 rounded-xl border border-[#20324A] flex">
                      {[15, 30, 50].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setLatencyLimit(val)}
                          className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                            latencyLimit === val
                              ? "bg-[#20324A] text-white"
                              : "text-[#9FB0C5] hover:text-white"
                          }`}
                        >
                          آخر {val}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* KPI metrics inside the chart card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#07111F] border border-[#20324A]/40 p-3.5 rounded-2xl flex items-center justify-between">
                  <div className="text-right">
                    <span className="text-[10px] text-[#9FB0C5]">متوسط زمن المزامنة</span>
                    <strong className="block text-sm font-black text-[#24C78E] mt-0.5 font-mono">
                      {(
                        (data.successfulRunsLatency30Days.reduce((sum, r) => sum + r.durationMs, 0) /
                          data.successfulRunsLatency30Days.length) /
                        1000
                      ).toFixed(2)}{" "}
                      ثانية
                    </strong>
                  </div>
                  <Timer className="w-5 h-5 text-[#24C78E]/40" />
                </div>

                <div className="bg-[#07111F] border border-[#20324A]/40 p-3.5 rounded-2xl flex items-center justify-between">
                  <div className="text-right">
                    <span className="text-[10px] text-[#9FB0C5]">أقصى زمن استجابة (الذروة)</span>
                    <strong className="block text-sm font-black text-amber-500 mt-0.5 font-mono">
                      {(Math.max(...data.successfulRunsLatency30Days.map((r) => r.durationMs)) / 1000).toFixed(2)}{" "}
                      ثانية
                    </strong>
                  </div>
                  <Gauge className="w-5 h-5 text-amber-500/40" />
                </div>

                <div className="bg-[#07111F] border border-[#20324A]/40 p-3.5 rounded-2xl flex items-center justify-between">
                  <div className="text-right">
                    <span className="text-[10px] text-[#9FB0C5]">أدنى زمن استجابة</span>
                    <strong className="block text-sm font-black text-[#2F80FF] mt-0.5 font-mono">
                      {(Math.min(...data.successfulRunsLatency30Days.map((r) => r.durationMs)) / 1000).toFixed(2)}{" "}
                      ثانية
                    </strong>
                  </div>
                  <Clock className="w-5 h-5 text-[#2F80FF]/40" />
                </div>
              </div>

              {/* Recharts Bar Chart */}
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={latencyViewMode === "individual" ? getIndividualRunsData() : getDailyAverageLatency()}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#20324A" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey={latencyViewMode === "individual" ? "indexLabel" : "formattedDate"}
                      stroke="#9FB0C5"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis
                      stroke="#9FB0C5"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
                    />
                    <Tooltip content={<LatencyTooltip />} />
                    
                    <Bar
                      dataKey={latencyViewMode === "individual" ? "durationMs" : "avgDurationMs"}
                      fill="url(#latencyGrad)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                    />
                    
                    <defs>
                      <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#24C78E" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#2F80FF" stopOpacity={0.15} />
                      </linearGradient>
                    </defs>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 3. Detailed Infrastructure & Database Connection Indicators */}
          <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-4">
            <h3 className="text-xs font-extrabold text-white flex items-center gap-2 justify-start border-b border-[#20324A]/50 pb-3">
              <Server className="w-4 h-4 text-[#2F80FF]" />
              حالة اتصال الخادم وقواعد البيانات النشطة (Infrastructure Diagnostics)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="flex items-center justify-between p-3.5 bg-[#07111F] border border-[#20324A]/40 rounded-xl">
                <span className="text-xs text-[#9FB0C5]">قاعدة البيانات السحابية Supabase:</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                  data.diagnostics.isSupabaseConfigured 
                    ? "bg-[#24C78E]/15 text-[#24C78E]" 
                    : "bg-[#F05252]/15 text-[#F05252]"
                }`}>
                  {data.diagnostics.isSupabaseConfigured ? "متصلة ونشطة" : "غير متصلة"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#07111F] border border-[#20324A]/40 rounded-xl">
                <span className="text-xs text-[#9FB0C5]">محرك البيانات النشط (Backend):</span>
                <span className="text-xs font-bold text-white font-mono uppercase bg-[#12233A] px-2 py-0.5 rounded border border-[#20324A]">
                  {data.diagnostics.dataBackend || "local db"}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#07111F] border border-[#20324A]/40 rounded-xl">
                <span className="text-xs text-[#9FB0C5]">بيئة تشغيل التطبيق (Node Env):</span>
                <span className="text-xs font-bold text-[#F5A524] font-mono bg-[#F5A524]/10 px-2 py-0.5 rounded border border-[#F5A524]/20">
                  {data.diagnostics.nodeEnv}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#07111F] border border-[#20324A]/40 rounded-xl">
                <span className="text-xs text-[#9FB0C5]">إجمالي المنتجات المسجلة بالرادار:</span>
                <strong className="text-xs font-bold text-white font-mono">{data.diagnostics.totalProductsInDb} منتج</strong>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#07111F] border border-[#20324A]/40 rounded-xl">
                <span className="text-xs text-[#9FB0C5]">لقطات التغير المسجلة بالكامل:</span>
                <strong className="text-xs font-bold text-white font-mono">{data.diagnostics.totalSnapshotsInDb} لقطة</strong>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-[#07111F] border border-[#20324A]/40 rounded-xl">
                <span className="text-xs text-[#9FB0C5]">توقيت القاهرة المعتمد بالخادم:</span>
                <strong className="text-xs font-bold text-white font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#2F80FF]" />
                  {data.diagnostics.serverTimeCairo.dateStr} - {data.diagnostics.serverTimeCairo.hour.toString().padStart(2, '0')}:{data.diagnostics.serverTimeCairo.minute.toString().padStart(2, '0')}
                </strong>
              </div>
            </div>
          </div>

          {/* 4. Common Troubleshooting Scenarios Help section */}
          <div className="bg-[#12233A]/30 border border-[#20324A]/60 p-5 rounded-3xl space-y-4">
            <h3 className="text-xs font-bold text-white flex items-center gap-2 justify-start">
              <TriangleAlert className="w-4 h-4 text-[#F5A524]" />
              دليل حل المشاكل السريع (لماذا لا تظهر البيانات؟)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-[#9FB0C5]">
              <div className="p-3 bg-[#07111F]/40 border border-[#20324A]/20 rounded-xl space-y-1">
                <h4 className="font-extrabold text-white">1. المزامنة ناجحة ولكن لا توجد سحوبات:</h4>
                <p>هذا طبيعي جداً ويعني أن مخزون المورد مستقر تماماً ولم ينقص. الرادار يسجل "سحوبات" فقط عندما تقل كمية منتج ما لدى المورد مقارنة بالفحص السابق.</p>
              </div>
              <div className="p-3 bg-[#07111F]/40 border border-[#20324A]/20 rounded-xl space-y-1">
                <h4 className="font-extrabold text-white">2. المزامنة تفشل بسبب انتهاء الوقت (Timeout):</h4>
                <p>يحدث هذا عندما يكون خادم المورد بطيئاً جداً. قمنا بزيادة مهلة الانتظار إلى 45 ثانية لتفادي هذا الخطأ بالكامل وضمان معالجة ناجحة.</p>
              </div>
              <div className="p-3 bg-[#07111F]/40 border border-[#20324A]/20 rounded-xl space-y-1">
                <h4 className="font-extrabold text-white">3. وجود لقطات شاذة (Anomalies):</h4>
                <p>إذا انخفض مخزون منتج واحد بأكثر من 200 قطعة دفعة واحدة، يصنفها الرادار كحركة شاذة (مثال: إعادة تشغيل خادم المورد أو سحب الكتالوج بالكامل) ويتم إخفاؤها من الإحصائيات لعدم تشويه المبيعات الحقيقية.</p>
              </div>
              <div className="p-3 bg-[#07111F]/40 border border-[#20324A]/20 rounded-xl space-y-1">
                <h4 className="font-extrabold text-white">4. تصفير قاعدة البيانات للتحديث:</h4>
                <p>إذا تداخلت البيانات التاريخية أو حدث أي تضارب برمجى، يمكنك الضغط على "إعادة تعيين ومسح قاعدة البيانات" في الأسفل لبدء فحص ومطابقة نظيفة تماماً.</p>
              </div>
            </div>
          </div>

          {/* 5. Logs Viewer (Table + Advanced Filters) */}
          <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#2F80FF]" />
                  تفاصيل سجل الفحص والمطابقة البرمجية (API Call Logs)
                </h3>
                <p className="text-[11px] text-[#9FB0C5] mt-0.5">عرض مخرجات عمليات الربط والـ API لكل دورة فحص وتفاصيل البيانات والصفحات المستلمة</p>
              </div>

              {/* Filters */}
              <div className="flex bg-[#07111F] p-1 rounded-xl self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filter === "all" ? "bg-[#2F80FF] text-white" : "text-[#9FB0C5] hover:text-white"
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("completed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filter === "completed" ? "bg-emerald-500/20 text-emerald-400" : "text-[#9FB0C5] hover:text-white"
                  }`}
                >
                  الناجحة
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("failed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filter === "failed" ? "bg-red-500/20 text-red-400" : "text-[#9FB0C5] hover:text-white"
                  }`}
                >
                  الفاشلة
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("processing")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filter === "processing" ? "bg-amber-500/20 text-amber-400" : "text-[#9FB0C5] hover:text-white"
                  }`}
                >
                  قيد المعالجة
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#20324A]/50">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#07111F] text-[#9FB0C5] pb-2 font-bold border-b border-[#20324A]">
                    <th className="p-4">رقم المعاملة (Run ID)</th>
                    <th className="p-4 text-center">القناة</th>
                    <th className="p-4 text-center">وقت البدء</th>
                    <th className="p-4 text-center">المنتجات المستلمة</th>
                    <th className="p-4 text-center">لقطات التغير</th>
                    <th className="p-4 text-center">عمليات السحب</th>
                    <th className="p-4 text-center">المدة الزمنية</th>
                    <th className="p-4 text-center">الحالة</th>
                    <th className="p-4 text-center">التشخيص والأخطاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#20324A]/40 text-white">
                  {filteredLogs.map((log) => {
                    const isSuccess = log.status === "COMPLETED";
                    const isProcessing = log.status === "PROCESSING" || log.status === "CONNECTING";
                    const isExpanded = expandedLogId === log.id;
                    
                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-[#12233A]/20 transition">
                          <td className="p-4 font-mono text-[10.5px] text-[#9FB0C5] font-semibold flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              isSuccess ? "bg-emerald-400" : isProcessing ? "bg-amber-400 animate-pulse" : "bg-red-400"
                            }`}></span>
                            {log.id.substring(0, 8)}...
                          </td>
                          <td className="p-4 text-center">
                            <span className="px-2 py-0.5 bg-[#12233A] rounded-md font-bold text-[10px] text-[#9FB0C5]">
                              {log.platform === "safka" ? "صفقة Safka" : "قناة مخصصة"}
                            </span>
                          </td>
                          <td className="p-4 text-center text-[10.5px] text-white font-mono">
                            {formatTimeArabic(log.createdAt || log.startedAt)}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-[#2F80FF]">
                            <div className="flex flex-col items-center justify-center">
                              <span>{log.productsReceived} منتج</span>
                              {log.status === "COMPLETED" && (log.productsReceived || 0) !== (log.productsUpdated || 0) && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-[#F5A524]/15 text-[#F5A524] rounded text-[8px] font-black mt-0.5" title="وجود تفاوت بين البيانات الواردة والمحفوظة">
                                  <TriangleAlert className="w-2.5 h-2.5 shrink-0" />
                                  تفاوت: {Math.abs((log.productsReceived || 0) - (log.productsUpdated || 0))}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-emerald-400">
                            {log.snapshotsCreated} لقطة
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-red-400">
                            {log.quantityDecreasesDetected} سحوبات
                          </td>
                          <td className="p-4 text-center font-mono text-[#9FB0C5]">
                            {getDurationText(log.startedAt, log.completedAt)}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              isSuccess 
                                ? "bg-[#24C78E]/10 text-[#24C78E]" 
                                : isProcessing 
                                ? "bg-amber-500/10 text-amber-400" 
                                : "bg-[#F05252]/10 text-[#F05252]"
                            }`}>
                              {isSuccess ? "ناجحة" : isProcessing ? "جاري المطابقة" : "فشلت"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-xs text-[#2F80FF] hover:underline font-bold cursor-pointer flex items-center gap-1 justify-center mx-auto"
                            >
                              <span>عرض التشخيص</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>
                        
                        {/* Diagnostic Expansion Panel */}
                        {isExpanded && (
                          <tr className="bg-[#07111F]/70">
                            <td colSpan={9} className="p-5 text-right font-mono text-[11px] text-[#9FB0C5] leading-relaxed border-t border-[#20324A]/50">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                
                                <div className="space-y-2 border-l border-[#20324A]/50 pl-4">
                                  <h4 className="font-extrabold text-white text-xs flex items-center gap-2 justify-start">
                                    <CloudLightning className="w-3.5 h-3.5 text-[#2F80FF]" />
                                    حالة تدفق الـ API والاتصال:
                                  </h4>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span>رمز المعاملة الكامل:</span><span className="text-white font-mono select-all">{log.id}</span></div>
                                    <div className="flex justify-between"><span>الصفحات المطلوبة:</span><span className="text-white font-mono">{log.pagesRequested || 1} صفحة</span></div>
                                    <div className="flex justify-between"><span>الصفحات المكتملة:</span><span className="text-white font-mono">{log.pagesCompleted || 0} صفحة</span></div>
                                    <div className="flex justify-between"><span>المحاولات (Retries):</span><span className="text-white font-mono">{log.retryCount || 0} محاولة</span></div>
                                  </div>
                                </div>

                                <div className="space-y-2 border-l border-[#20324A]/50 pl-4">
                                  <h4 className="font-extrabold text-white text-xs flex items-center gap-2 justify-start">
                                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                                    مخرجات معالجة المنتجات:
                                  </h4>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span>المنتجات المستلمة:</span><span className="text-white font-mono">{log.productsReceived} منتج</span></div>
                                    <div className="flex justify-between"><span>المنتجات المحدثة بالرادار:</span><span className="text-[#2F80FF] font-mono font-bold">{log.productsUpdated} منتج</span></div>
                                    <div className="flex justify-between"><span>لقطات التغير المسجلة:</span><span className="text-emerald-400 font-mono font-bold">{log.snapshotsCreated} لقطة</span></div>
                                    <div className="flex justify-between"><span>المنتجات المتجاوزة (Skipped):</span><span className="text-white font-mono">{log.productsSkipped || 0} منتج</span></div>
                                    <div className="flex justify-between"><span>حركات إعادة التخزين:</span><span className="text-white font-mono">{log.restocksDetected || 0} حركات</span></div>
                                    <div className="flex justify-between border-t border-[#20324A]/40 pt-1 mt-1">
                                      <span>حالة سلامة البيانات:</span>
                                      {(log.productsReceived || 0) === (log.productsUpdated || 0) ? (
                                        <span className="text-[#24C78E] font-bold">✓ متطابقة تماماً</span>
                                      ) : (
                                        <span className="text-[#F5A524] font-bold flex items-center gap-1">
                                          <TriangleAlert className="w-3 h-3 shrink-0" />
                                          تفاوت بقيمة {Math.abs((log.productsReceived || 0) - (log.productsUpdated || 0))} منتج
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <h4 className="font-extrabold text-white text-xs flex items-center gap-2 justify-start">
                                    <TriangleAlert className="w-3.5 h-3.5 text-red-400" />
                                    تقرير الأعطال والمشكلات:
                                  </h4>
                                  {log.errors && log.errors.length > 0 ? (
                                    <div className="space-y-1">
                                      <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded text-red-400 text-[10px] whitespace-pre-wrap">
                                        {log.errorSummary || log.errors.join("; ")}
                                      </div>
                                      <pre className="text-[9px] bg-[#07111F] p-2 rounded max-h-24 overflow-y-auto border border-[#20324A]">
                                        {JSON.stringify(log.errors, null, 2)}
                                      </pre>
                                    </div>
                                  ) : (
                                    <span className="text-emerald-400 text-xs font-semibold block">لا توجد أي أخطاء أو تحذيرات برمجية. الدورة تمت بسلام بنسبة ١٠٠٪.</span>
                                  )}
                                </div>

                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs text-[#9FB0C5]">
                        لا توجد سجلات مطابقة للفلتر المحدد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

    </div>
  );
}
