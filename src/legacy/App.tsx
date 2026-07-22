// @ts-nocheck
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Product, 
  SyncRun, 
  PlatformConnection, 
  OverviewMetrics, 
  ChartTimelinePoint, 
  DashboardPayload,
  WeeklyDayRecord,
  AnalyticsNavigationIntent,
  ActivityLog
} from "./types";

// Import modular components
import Sidebar from "./components/Sidebar";
import TopHeader from "./components/TopHeader";
import MetricCards from "./components/MetricCards";
import DashboardOverview from "./components/DashboardOverview";
import ProductsTab from "./components/ProductsTab";
import ProductDetailDrawer from "./components/ProductDetailDrawer";
import AnalyticsTabs from "./components/AnalyticsTabs";
import ConnectionsTab from "./components/ConnectionsTab";
import SyncLogsTab from "./components/SyncLogsTab";
import HourlyAnalyticsPage from "./components/HourlyAnalyticsPage";
import { DeliveryReturnsAuditPage } from "./components/DeliveryReturnsAuditPage";
import Login from "./components/Login";
import { DateRangePicker } from "./components/DateRangePicker";
import AdsSpyPage from "./components/ads-spy/AdsSpyPage";
import { AdsSpyProduct } from "./ads-spy-types";
import { auth, firebaseInitError } from "./lib/firebase";
import { signOut } from "firebase/auth";
import { logTimeDiagnostics } from "./lib/diagnostics";
import { getCairoTodayStr, addDaysToDateStr } from "./shared/time";
import { safeFetchJson } from "./lib/api";
import { toAdsSpyProductId } from "./lib/adsSpyProductId";

import { 
  Wifi, 
  CircleCheck, 
  CircleX, 
  RefreshCw, 
  Info,
  Clock,
  Radio,
  Lock,
  ChevronRight,
  ChevronLeft,
  Calendar
} from "lucide-react";

function toAdsSpyProduct(product: Product): AdsSpyProduct {
  return {
    id: toAdsSpyProductId(product.id),
    name: product.name,
    sku: product.sku || product.externalProductId || undefined,
    category: product.originalCategory || undefined,
    product_url: product.productUrl || undefined,
    image_url: product.imageUrl || undefined,
    brand: undefined,
    raw_metadata: {
      platform: product.platform,
      baseProductId: product.id,
      externalProductId: product.externalProductId,
      price: product.price,
      currency: product.currency,
      currentQuantity: product.currentQuantity,
      previousQuantity: product.previousQuantity,
      productStatus: product.productStatus,
      withdrawnPieces: product.withdrawnPieces,
      withdrawalEvents: product.withdrawalEvents,
      lastWithdrawalAt: product.lastWithdrawalAt
    }
  };
}

export default function App() {
  // Session / Authentication State
  const [session, setSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!auth) {
      setCheckingSession(false);
      return;
    }
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      const allowedEmail = "ziadalwafa0@gmail.com";
      if (user && user.email?.toLowerCase() !== allowedEmail) {
        signOut(auth);
        setSession(null);
      } else {
        setSession(user);
      }
      setCheckingSession(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setSession(null);
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Data States
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    syncing: boolean;
    processedCount: number;
    totalProducts: number;
    statusText: string;
    percentage: number;
  } | null>(null);
  const [syncError, setSyncError] = useState<{
    code: string;
    platform: string;
  } | null>(null);
  
  // Poll manual sync progress
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let failCount = 0;

    const fetchProgress = async () => {
      try {
        const data = await safeFetchJson<{
          success: boolean;
          syncing: boolean;
          processedCount: number;
          totalProducts: number;
          statusText: string;
          percentage: number;
          lastError?: string;
          lastErrorPlatform?: string;
        }>("/api/sync/progress");
        
        failCount = 0; // reset on success
        if (data.success) {
          setSyncProgress({
            syncing: data.syncing,
            processedCount: data.processedCount,
            totalProducts: data.totalProducts,
            statusText: data.statusText,
            percentage: data.percentage
          });

          if (data.syncing) {
            setSyncing(true);
            setSyncError(null);
          } else {
            setSyncing(false);
            if (data.lastError) {
              setSyncError({
                code: data.lastError,
                platform: data.lastErrorPlatform || "safka"
              });
            }
          }
        }
      } catch (e: any) {
        failCount++;
        const nextDelay = Math.min(30000, 5000 * Math.pow(2, failCount - 1));
        if (interval) {
           clearInterval(interval);
           if (syncing) interval = setInterval(fetchProgress, nextDelay);
        }
        if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
          console.warn("Error fetching sync progress (transient):", e.message);
        } else {
          console.error("Error fetching sync progress:", e);
        }
      }
    };

    fetchProgress();
    if (syncing) {
      interval = setInterval(fetchProgress, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncing]);

  const [testing, setTesting] = useState(false);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [chartData, setChartTimeline] = useState<ChartTimelinePoint[]>([]);
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyDayRecord[]>([]);
  const [platformConnections, setPlatformConnections] = useState<PlatformConnection[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [scheduler, setScheduler] = useState({ enabled: true, intervalMinutes: 20 });
  const [toast, setToast] = useState<string | null>(null);

  // Filter States
  const [selectedDate, setSelectedDate] = useState<string>(() => getCairoTodayStr());
  const [selectedToDate, setSelectedToDate] = useState<string>(() => getCairoTodayStr());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  // Selected details drawer states
  const [activeProductDetail, setActiveProductDetail] = useState<Product | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [showTestSheet, setShowTestSheet] = useState(false);

  // Platform Edit Forms state
  const [selectedFormPlatform, setSelectedFormPlatform] = useState<"safka" | "custom">("safka");
  const [formMode, setFormMode] = useState<"live" | "demo">("live");
  const [formBaseUrl, setFormBaseUrl] = useState("https://api.safka-eg.com");
  const [formEndpoint, setFormProductsEndpoint] = useState("/api/v1/public/products");
  const [formApiKeyHeader, setFormApiKeyHeader] = useState("api-safka-key");
  const [formApiKey, setFormApiKey] = useState("");
  const [formQuantityPath, setFormQuantityPath] = useState("properties.0.value");

  // Live cairo clock
  const [cairoTime, setCairoTime] = useState(new Date());
  const [revision, setRevision] = useState<string | null>(null);
  const [forceSyncRequired, setForceSyncRequired] = useState(false);

  useEffect(() => {
    const pollRevision = async () => {
      try {
        const data = await safeFetchJson<{ revision: string }>("/api/analytics/revision");
        setRevision(data.revision);
      } catch (e: any) {
        if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
          console.warn("Polling revision (transient):", e.message);
        } else {
          console.error("Polling revision failed:", e);
        }
      }
    };
    
    // Poll every 15s
    const interval = setInterval(pollRevision, 15000);
    // Add visibility change listener
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') pollRevision();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Initial fetch
    pollRevision();
    
    return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Overview metrics state from dedicated stable endpoint
  interface DashboardOverviewData {
    monitoredProducts: number;
    withdrawnPiecesLastCompletedHour: number;
    withdrawnPiecesToday: number;
    acceleratedProducts: number;
    withdrawalEventsToday: number;
    affectedProductsToday: number;
    dataCompletenessPercentage: number;
    apiHealthPercentage: number;
    activeCairoDate?: string;
    lastCompletedCairoDate?: string;
    lastCompletedCairoHour?: number;
  }
  const [overviewData, setOverviewData] = useState<DashboardOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [navigationIntent, setNavigationIntent] = useState<AnalyticsNavigationIntent>(null);

  const fetchOverviewData = async () => {
    setOverviewLoading(true);
    try {
      const params = new URLSearchParams({
        platformConnectionId: selectedPlatform,
        date: selectedDate,
        toDate: selectedToDate
      });
      const data = await safeFetchJson<any>(`/api/analytics/dashboard-overview?${params.toString()}`);
      if (data.success) {
        setOverviewData(data);
      }
    } catch (e: any) {
      if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
        console.warn("Error fetching overview metrics (transient):", e.message);
      } else {
        console.error("Error fetching overview metrics:", e);
      }
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    logTimeDiagnostics();
  }, [selectedPlatform, selectedDate, selectedToDate]);

  // Load Dashboard Data
  const fetchDashboardData = async () => {
    try {
      const params = new URLSearchParams({
        platform: selectedPlatform,
        category: selectedCategory,
        status: selectedStatus,
        q: searchQuery,
        date: selectedDate,
        toDate: selectedToDate
      });
      const payload = await safeFetchJson<DashboardPayload>(`/api/dashboard?${params.toString()}`);
      if (payload.success) {
        setMetrics(payload.overview);
        setProducts(payload.products);
        setCategories(payload.categories);
        setSyncRuns(payload.syncRuns);
        setChartTimeline(payload.chartTimeline);
        setWeeklyHistory(payload.weeklyHistory || []);
        setPlatformConnections(payload.platformConnections);
        setScheduler(payload.scheduler);
        if (payload.activityLogs) {
          setActivityLogs(payload.activityLogs);
        }
          
          // Pre-fill form values on first load based on active platform connections
          const safkaConn = payload.platformConnections.find(c => c.platform === "safka");
          if (safkaConn) {
            setFormMode(safkaConn.mode);
            setFormBaseUrl(safkaConn.baseUrl);
            setFormProductsEndpoint(safkaConn.productsEndpoint);
            setFormApiKeyHeader(safkaConn.apiKeyHeader);
            setFormQuantityPath(safkaConn.fieldMapping.quantityPath);
            if (safkaConn.apiKey) {
              setFormApiKey(safkaConn.apiKey);
            }
          }
        }
    } catch (e: any) {
      if (e?.message && (e.message.includes("non-JSON") || e.message.includes("status: 502") || e.message.includes("status: 503") || e.message.includes("status: 504") || e.message.includes("Failed to fetch"))) {
        console.warn("Error fetching dashboard (transient):", e.message);
      } else {
        showToastMessage("خطأ في الاتصال بالخادم الرئيسي للمقاييس");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchOverviewData();
  }, [revision, selectedCategory, selectedStatus, searchQuery, selectedPlatform, selectedDate, selectedToDate]);

  // 20-minute auto-refresh for dashboard and overview data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchOverviewData();
    }, 20 * 60 * 1000);
    return () => clearInterval(interval);
  }, [revision, selectedCategory, selectedStatus, searchQuery, selectedPlatform, selectedDate, selectedToDate]);

  // Refresh on focus
  useEffect(() => {
    const handleFocus = () => {
      fetchDashboardData();
      fetchOverviewData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revision, selectedCategory, selectedStatus, searchQuery, selectedPlatform, selectedDate, selectedToDate]);

  // Cairo clock simulator
  useEffect(() => {
    const updateTime = () => {
      setCairoTime(new Date());
    };
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-collapse sidebar on mobile screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize(); // Run on initial mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const showToastMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sync manual execution trigger
  const handleSyncNow = async (force = false) => {
    setSyncing(true);
    setSyncError(null);
    showToastMessage(force ? "جاري فرض التحديث وتجاوز أي قفول نشطة ومطابقة المخازن..." : "جاري استدعاء كافة الصفحات وتحديث المخازن ومطابقتها فلياً...");
    const activePlatform = selectedPlatform === "all" ? "safka" : selectedPlatform;
    try {
      const data = await safeFetchJson<any>(`/api/platforms/${activePlatform}/sync${force ? "?force=true" : ""}`, { method: "POST" });
      if (data.success) {
        showToastMessage("اكتملت المزامنة بنجاح ورصد الفروقات والإمدادات الجديدة!");
        setForceSyncRequired(false);
        setSyncError(null);
        fetchDashboardData();
        fetchOverviewData();
      } else {
        if (data.error === "SYNC_ALREADY_RUNNING") {
          setForceSyncRequired(true);
          setSyncError({ code: "ERR_SYNC_ALREADY_RUNNING", platform: activePlatform });
          showToastMessage("تنبيه: هناك عملية تحديث جارية بالفعل. يمكنك فرض المزامنة لتخطي الانتظار.");
        } else {
          setSyncError({ code: "ERR_SYNC_FAILED", platform: activePlatform });
          showToastMessage(`فشل التحديث: ${data.error}`);
        }
      }
    } catch (e) {
      setSyncError({ code: "ERR_CONNECTION_INTERRUPTED", platform: activePlatform });
      showToastMessage("خطأ أثناء الاتصال بمزامنة الكتالوج");
    } finally {
      setSyncing(false);
    }
  };

  const handleSchedulerChange = async (enabled: boolean, intervalMinutes: number) => {
    try {
      const data = await safeFetchJson<any>("/api/settings/scheduler", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, intervalMinutes })
      });
      setScheduler(data.scheduler);
      showToastMessage("تم تحديث إعدادات المزامنة التلقائية بنجاح!");
    } catch (e) {
      showToastMessage("خطأ في تحديث إعدادات المزامنة");
    }
  };

  // Connection config test execution
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setShowTestSheet(true);
    try {
      // First save current values before testing
      const payload = {
        mode: formMode,
        baseUrl: formBaseUrl,
        productsEndpoint: formEndpoint,
        apiKeyHeader: formApiKeyHeader,
        apiKey: formApiKey,
        fieldMapping: {
          productsPath: "data",
          productIdPath: "_id",
          productNamePath: "name",
          skuPath: "barcode",
          quantityPath: formQuantityPath,
          pricePath: "sale_price",
          imagePath: "image",
          categoryPath: "category.name",
          variantsPath: "properties",
          productUrlPath: ""
        }
      };

      await safeFetchJson<any>(`/api/platforms/${selectedFormPlatform}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const testRes = await safeFetchJson<any>(`/api/platforms/${selectedFormPlatform}/test`, { method: "POST" });
      setTestResult(testRes);
      if (testRes.success) {
        showToastMessage("نجح الاتصال الفعلي بالمنصة وقنوات تزويد الكتالوج!");
      } else {
        showToastMessage("فشل الاتصال بالـ API المالي للمورد");
      }
    } catch (e) {
      showToastMessage("فشل اختبار الربط المباشر بالقناة");
    } finally {
      setTesting(false);
    }
  };

  // Connection save credentials
  const handleSaveConnection = async () => {
    try {
      const payload = {
        mode: formMode,
        baseUrl: formBaseUrl,
        productsEndpoint: formEndpoint,
        apiKeyHeader: formApiKeyHeader,
        apiKey: formApiKey,
        fieldMapping: {
          productsPath: "data",
          productIdPath: "_id",
          productNamePath: "name",
          skuPath: "barcode",
          quantityPath: formQuantityPath,
          pricePath: "sale_price",
          imagePath: "image",
          categoryPath: "category.name",
          variantsPath: "properties",
          productUrlPath: ""
        }
      };

      await safeFetchJson<any>(`/api/platforms/${selectedFormPlatform}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      showToastMessage("تم حفظ وتحديث إعدادات ربط صفقة بنجاح في قاعدة البيانات");
      fetchDashboardData();
      fetchOverviewData();
    } catch (e) {
      showToastMessage("خطأ في حفظ وتفويض مفاتيح التراخيص للمنصة");
    }
  };

  const handleResetDatabase = async () => {
    try {
      const data = await safeFetchJson<any>("/api/reset", { method: "POST" });
      if (data.success) {
        showToastMessage("تم تهيئة وقص قواعد البيانات وبدء رصد نظيف كلياً!");
        fetchDashboardData();
          fetchOverviewData();
        } else {
          showToastMessage(`فشل تهيئة الأنظمة: ${data.error}`);
        }
    } catch (e) {
      showToastMessage("خطأ أثناء تصفير وحذف الكتالوج");
    }
  };

  if (firebaseInitError || !auth) {
    return (
      <div className="min-h-screen bg-[#07111F] text-[#F4F7FB] flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-[#0D1B2D] border border-amber-500/30 rounded-[24px] p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-sm font-extrabold text-white">تم حظر الاتصال بالرادار (قيود المتصفح)</h2>
          <p className="text-[11px] text-[#9FB0C5] leading-relaxed">
            تم حظر الوصول إلى قاعدة البيانات والتحقق من الهوية من قبل المتصفح. يحدث هذا غالباً بسبب قيود ملفات تعريف الارتباط للطرف الثالث (Third-party Cookies) أو حظر التخزين المحلي داخل إطار المعاينة (iFrame).
          </p>
          <div className="bg-[#07111F] p-4 rounded-xl text-left font-mono text-[10.5px] text-amber-400 border border-amber-500/10 overflow-x-auto">
            {firebaseInitError || "auth_service_not_initialized"}
          </div>
          <div className="pt-2">
            <a 
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 bg-[#2F80FF] hover:bg-[#2F80FF]/90 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#2F80FF]/15 transition cursor-pointer"
            >
              <span>فتح المنصة في نافذة جديدة</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <p className="text-[10px] text-[#9FB0C5]/50 leading-normal">
            بعد فتحها في علامة تبويب جديدة، ستتمكن من تسجيل الدخول باستخدام حساب Google المعتمد ومزامنة البيانات بشكل طبيعي.
          </p>
        </div>
      </div>
    );
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#07111F] flex items-center justify-center">
        <div className="text-white">جاري التحقق من الجلسة...</div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={setSession} />;
  }

  return (
    <div 
      className="min-h-screen w-full bg-[#07111F] text-[#F4F7FB] flex font-sans antialiased overflow-x-hidden selection:bg-[#2F80FF] selection:text-white" 
      dir="rtl"
    >
      {/* Right Collapsible Sidebar (RTL default layout) */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        metrics={metrics}
        products={products}
        connections={platformConnections}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={handleLogout}
        schedulerInterval={scheduler.intervalMinutes}
        cairoTime={cairoTime}
        schedulerEnabled={scheduler.enabled}
      />

      {/* Left Core Main Content frame */}
      <div 
        className={`flex-1 min-h-screen flex flex-col min-w-0 overflow-x-hidden transition-all duration-300 ${
          sidebarOpen ? "mr-64" : "mr-20"
        }`}
      >
        {/* Dynamic header */}
        <TopHeader 
          activeTab={activeTab}
          selectedPlatform={selectedPlatform}
          setSelectedPlatform={setSelectedPlatform}
          syncing={syncing}
          syncStatus={syncing ? "جارٍ المزامنة..." : "متصل ومستقر"}
          syncStatusDetails={syncing ? "يجري استرداد كتالوج المورد وتحديث اللقطات" : ""}
          onSyncNow={handleSyncNow}
          cairoTime={cairoTime}
          schedulerEnabled={scheduler.enabled}
          schedulerInterval={scheduler.intervalMinutes}
          onSchedulerChange={handleSchedulerChange}
          forceSyncRequired={forceSyncRequired}
          syncProgress={syncProgress}
          syncError={syncError}
          onClearSyncError={() => setSyncError(null)}
          platformConnections={platformConnections}
        />

        {/* Content Body Wrapper */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          
          {/* Visual Date Selection Widget (Ads Manager style) */}
          <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 text-right shadow-lg animate-fade-in">
            <div>
              <h3 className="text-sm font-black text-[#F4F7FB] flex items-center gap-2 justify-start">
                <Clock className="w-4.5 h-4.5 text-[#2F80FF]" />
                رصد البيانات للمدى الزمني المحدد
              </h3>
              <p className="text-[11px] text-[#9FB0C5] mt-1">
                اختر تاريخ البدء وتاريخ الانتهاء لعرض كافة السحوبات والمؤشرات والنسب التراكمية في هذه الفترة.
              </p>
            </div>

            {/* Quick selectors + Custom date range picker */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full lg:w-auto">
              
              {/* Predefined Quick Selectors */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full">
                {(() => {
                  const today = getCairoTodayStr();
                  
                  // Today
                  const isToday = selectedDate === today && selectedToDate === today;
                  
                  // Yesterday
                  const yesterday = addDaysToDateStr(today, -1);
                  const isYesterday = selectedDate === yesterday && selectedToDate === yesterday;
                  
                  // Last 7 Days
                  const last7 = addDaysToDateStr(today, -6);
                  const isLast7 = selectedDate === last7 && selectedToDate === today;
                  
                  // This Month (from 1st of current month to today)
                  const firstOfOfMonth = today.substring(0, 8) + "01";
                  const isThisMonth = selectedDate === firstOfOfMonth && selectedToDate === today;

                  return (
                    <>
                      <button
                        onClick={() => {
                          setSelectedDate(today);
                          setSelectedToDate(today);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer shrink-0 min-w-[70px] ${
                          isToday
                            ? "bg-[#2F80FF] text-white border-[#2F80FF] shadow-lg shadow-[#2F80FF]/15"
                            : "bg-[#07111F]/50 text-[#9FB0C5] border-[#20324A] hover:bg-[#12233A] hover:text-[#F4F7FB]"
                        }`}
                      >
                        اليوم
                      </button>

                      <button
                        onClick={() => {
                          setSelectedDate(yesterday);
                          setSelectedToDate(yesterday);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer shrink-0 min-w-[70px] ${
                          isYesterday
                            ? "bg-[#2F80FF] text-white border-[#2F80FF] shadow-lg shadow-[#2F80FF]/15"
                            : "bg-[#07111F]/50 text-[#9FB0C5] border-[#20324A] hover:bg-[#12233A] hover:text-[#F4F7FB]"
                        }`}
                      >
                        أمس
                      </button>

                      <button
                        onClick={() => {
                          setSelectedDate(last7);
                          setSelectedToDate(today);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer shrink-0 min-w-[85px] ${
                          isLast7
                            ? "bg-[#2F80FF] text-white border-[#2F80FF] shadow-lg shadow-[#2F80FF]/15"
                            : "bg-[#07111F]/50 text-[#9FB0C5] border-[#20324A] hover:bg-[#12233A] hover:text-[#F4F7FB]"
                        }`}
                      >
                        آخر 7 أيام
                      </button>

                      <button
                        onClick={() => {
                          setSelectedDate(firstOfOfMonth);
                          setSelectedToDate(today);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer shrink-0 min-w-[85px] ${
                          isThisMonth
                            ? "bg-[#2F80FF] text-white border-[#2F80FF] shadow-lg shadow-[#2F80FF]/15"
                            : "bg-[#07111F]/50 text-[#9FB0C5] border-[#20324A] hover:bg-[#12233A] hover:text-[#F4F7FB]"
                        }`}
                      >
                        الشهر الحالي
                      </button>
                    </>
                  );
                })()}
              </div>

              {/* Custom Date Range Picker */}
              <DateRangePicker
                startDate={selectedDate}
                endDate={selectedToDate}
                onChange={(start, end) => {
                  setSelectedDate(start);
                  setSelectedToDate(end);
                }}
                align="left"
              />

            </div>
          </div>

          {/* Top Row: Metric KPIs (visible on all primary tab screens) */}
          <MetricCards 
            overviewData={overviewData}
            loading={overviewLoading}
            setActiveTab={setActiveTab}
            setSelectedStatus={setSelectedStatus}
            setNavigationIntent={setNavigationIntent}
          />

          {/* Active Workspace Container */}
          <div className="pt-2">
            <AnimatePresence mode="wait">
              <motion.div
                key="workspace-container-transition-wrapper"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.15 }}
              >
                <React.Suspense fallback={
                  <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center bg-[#0D1B2D] border border-[#20324A] rounded-3xl">
                    <RefreshCw className="w-8 h-8 text-[#2F80FF] animate-spin" />
                    <p className="text-xs text-[#9FB0C5]">جاري تحميل محتوى الصفحة...</p>
                  </div>
                }>
                  {/* 1. Overview Tab */}
                  {activeTab === "home" && (
                    <DashboardOverview 
                      products={products}
                      syncRuns={syncRuns}
                      chartData={chartData}
                      weeklyHistory={weeklyHistory}
                      onProductClick={setActiveProductDetail}
                      metrics={metrics}
                    />
                  )}



                {/* 1.5 Hourly Analytics Tab */}
                {activeTab === "hourly_analytics" && (
                  <HourlyAnalyticsPage 
                    onProductClick={setActiveProductDetail}
                    selectedPlatform={selectedPlatform}
                    navigationIntent={navigationIntent}
                    clearNavigationIntent={() => setNavigationIntent(null)}
                    revision={revision}
                    defaultDate={overviewData?.activeCairoDate}
                  />
                )}

                {/* 2. Product Explorer Tab */}
                {activeTab === "products" && (
                  <ProductsTab 
                    products={products}
                    categories={categories}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    selectedStatus={selectedStatus}
                    setSelectedStatus={setSelectedStatus}
                    onProductClick={setActiveProductDetail}
                    selectedPlatform={selectedPlatform}
                    defaultDate={overviewData?.activeCairoDate}
                  />
                )}

                {/* 2.5 Ads Spy Tab */}
                {activeTab === "ads_spy" && (
                  <AdsSpyPage 
                    products={products.map(toAdsSpyProduct)}
                    initialProductId={null}
                    onOpenBaseProduct={(productId) => {
                      const p = products.find(prod => toAdsSpyProductId(prod.id) === productId);
                      if (p) setActiveProductDetail(p);
                    }}
                  />
                )}

                {/* 3-8. Analytics Views Tabs */}
                {["highest_decrease", "trending", "categories", "restock", "compare", "alerts"].includes(activeTab) && (
                  <AnalyticsTabs 
                    activeTab={activeTab}
                    products={products}
                    categories={categories}
                    metrics={metrics}
                    onProductClick={setActiveProductDetail}
                  />
                )}

                {/* 8.5 Delivery and Returns Audit Page */}
                {activeTab === "delivery_returns_audit" && (
                  <DeliveryReturnsAuditPage 
                    onProductClick={setActiveProductDetail}
                  />
                )}

                {/* 9. Connection Credential Manager */}
                {activeTab === "connect" && (
                  <ConnectionsTab 
                    connections={platformConnections}
                    selectedFormPlatform={selectedFormPlatform}
                    setSelectedFormPlatform={setSelectedFormPlatform}
                    formApiKeyHeader={formApiKeyHeader}
                    setFormApiKeyHeader={setFormApiKeyHeader}
                    formApiKey={formApiKey}
                    setFormApiKey={setFormApiKey}
                    formBaseUrl={formBaseUrl}
                    setFormBaseUrl={setFormBaseUrl}
                    formEndpoint={formEndpoint}
                    setFormEndpoint={setFormProductsEndpoint}
                    testing={testing}
                    onTestConnection={handleTestConnection}
                    onSaveConnection={handleSaveConnection}
                  />
                )}

                {/* 10-11. Sync history and Settings Panels */}
                {["history", "settings"].includes(activeTab) && (
                  <SyncLogsTab 
                    activeTab={activeTab}
                    syncRuns={syncRuns}
                    metrics={metrics}
                    onResetDatabase={handleResetDatabase}
                    connections={platformConnections}
                    activityLogs={activityLogs}
                  />
                )}

                </React.Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

        </main>

        {/* Global Footer */}
        <footer className="py-6 text-center text-[11px] text-[#9FB0C5]/40 border-t border-[#20324A]/40 bg-[#081525]/30">
          جميع حقوق مطابقة ورصد كتالوج صفقة لدروبشيبينغ مصر محفوظة © 2026
        </footer>
      </div>

       {/* Simulated Product Detail Drawer sheet */}
      <React.Suspense fallback={null}>
        <ProductDetailDrawer 
          activeProductDetail={activeProductDetail}
          onClose={() => setActiveProductDetail(null)}
          selectedDate={new URLSearchParams(window.location.search).get("date") || undefined}
          userId={session?.uid}
        />
      </React.Suspense>

      {/* Connection Test Overlay Results Dialog */}
      <AnimatePresence>
        {showTestSheet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTestSheet(false)}
              className="fixed inset-0 bg-black/85 cursor-pointer"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-[#0D1B2D] border border-[#20324A] rounded-[24px] p-6 z-55 text-right space-y-5 shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-[#20324A]/40 pb-3">
                <h3 className="text-xs font-extrabold text-white">نتائج الاتصال الفعلي والاختبار البرمجي للـ API</h3>
                <button 
                  onClick={() => setShowTestSheet(false)}
                  className="px-3 py-1.5 bg-[#12233A] hover:bg-[#20324A] text-[10px] rounded-lg text-white transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>

              {testing ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <RefreshCw className="w-8 h-8 text-[#2F80FF] animate-spin" />
                  <p className="text-xs text-[#9FB0C5]">جاري توقيع وبث الطلب المالي للخادم للتحقق من التراخيص...</p>
                </div>
              ) : (
                <div className="space-y-4 text-xs text-right">
                  {testResult?.success ? (
                    <div className="bg-[#24C78E]/10 border border-[#24C78E]/20 p-4 rounded-xl flex items-center gap-2 text-[#24C78E] font-bold">
                      <CircleCheck className="w-5 h-5 text-[#24C78E] shrink-0" />
                      <span>اتصال ناجح! تم تأكيد الترخيص واسترداد عينات الكتالوج العام.</span>
                    </div>
                  ) : (
                    <div className="bg-[#F05252]/10 border border-[#F05252]/20 p-4 rounded-xl flex items-center gap-2 text-[#F05252] font-bold">
                      <CircleX className="w-5 h-5 text-[#F05252] shrink-0" />
                      <span>فشل مصادقة الربط! يرجى التحقق من صحة مفتاح الـ API والمسارات المدخلة.</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="font-extrabold text-[#F4F7FB]">الاستجابة الفنية المستلمة:</h4>
                    <div className="bg-[#07111F] p-4 rounded-xl space-y-1.5 font-mono text-[10.5px] text-[#9FB0C5] text-left border border-[#20324A]/40">
                      <div>Platform: {testResult?.platform || selectedFormPlatform}</div>
                      <div>Status Code: {testResult?.success ? 200 : 401}</div>
                      <div>Response Time: {testResult?.responseTimeMs || 120}ms</div>
                      <div>Tracked Products Received: {testResult?.productsDetected || 0} items</div>
                    </div>
                  </div>

                  {testResult?.sample && (
                    <div className="space-y-2">
                      <h4 className="font-extrabold text-[#F4F7FB]">عينة سلعة تم استلامها وفك تشفير مسارها:</h4>
                      <div className="bg-[#07111F] p-4 rounded-xl space-y-1.5 font-mono text-[10.5px] text-[#9FB0C5] text-right border border-[#20324A]/40 leading-relaxed">
                        <div>اسم السلعة: <strong className="text-white">{testResult.sample.name}</strong></div>
                        <div>الكمية المرصودة بالمستودع: <strong className="text-white">{testResult.sample.quantity} قطعة</strong></div>
                        <div>الـ SKU المعتمد: <strong className="text-white">{testResult.sample.sku}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Simulated Toast alerts popups */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-55 bg-[#0D1B2D] border border-[#20324A] text-white py-3.5 px-6 rounded-2xl shadow-2xl text-xs text-center font-bold font-sans"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
