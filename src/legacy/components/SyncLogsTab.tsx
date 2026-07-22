import React, { useState } from "react";
import { 
  History, 
  RefreshCw, 
  AlertTriangle, 
  AlertCircle,
  CircleCheck, 
  XCircle, 
  Info,
  Clock,
  Database,
  Trash2,
  Sliders,
  ChevronRight,
  Code,
  Wifi,
  ShieldCheck,
  MessageSquare,
  Smartphone,
  Mail,
  HelpCircle,
  Search,
  Filter,
  Activity,
  User,
  Eye,
  Download
} from "lucide-react";
import { SyncRun, OverviewMetrics, PlatformConnection, ActivityLog } from "../types";
import DiagnosticLogsViewer from "./DiagnosticLogsViewer";
import { safeFetchJson } from "../lib/api";
import { formatCairoTime } from "../shared/time";

interface SyncLogsTabProps {
  activeTab: string;
  syncRuns: SyncRun[];
  metrics: OverviewMetrics | null;
  onResetDatabase: () => void;
  connections?: PlatformConnection[];
  activityLogs?: ActivityLog[];
}

export default function SyncLogsTab({
  activeTab,
  syncRuns,
  metrics,
  onResetDatabase,
  connections = [],
  activityLogs = []
}: SyncLogsTabProps) {

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ platform: string; success: boolean; responseTimeMs?: number; productsDetected?: number; sample?: any; error?: string } | null>(null);

  // Email Alerts settings states
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailAddress, setEmailAddress] = useState("ziadalwafa0@gmail.com");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);

  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState<string | null>(null);
  const [emailSaveError, setEmailSaveError] = useState<string | null>(null);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestSuccess, setEmailTestSuccess] = useState<string | null>(null);
  const [emailTestError, setEmailTestError] = useState<string | null>(null);

  // Supabase connection states
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseSecretKey, setSupabaseSecretKey] = useState("");
  const [supabaseEnabled, setSupabaseEnabled] = useState(false);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseSaving, setSupabaseSaving] = useState(false);
  const [supabaseSaveSuccess, setSupabaseSaveSuccess] = useState<string | null>(null);
  const [supabaseSaveError, setSupabaseSaveError] = useState<string | null>(null);
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseTestSuccess, setSupabaseTestSuccess] = useState<string | null>(null);
  const [supabaseTestError, setSupabaseTestError] = useState<string | null>(null);

  // Activity Log interactive states
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

  React.useEffect(() => {
    if (activeTab === "settings") {
      const fetchEmailSettings = async () => {
        setEmailLoading(true);
        try {
          const res = await safeFetchJson<any>("/api/settings/email");
          if (res.success && res.emailAlerts) {
            setEmailEnabled(!!res.emailAlerts.enabled);
            setEmailAddress(res.emailAlerts.email || "ziadalwafa0@gmail.com");
            setSmtpHost(res.emailAlerts.smtpHost || "");
            setSmtpPort(res.emailAlerts.smtpPort || 587);
            setSmtpUser(res.emailAlerts.smtpUser || "");
            setSmtpPass(res.emailAlerts.smtpPass || "");
            setSmtpSecure(!!res.emailAlerts.smtpSecure);
            setEmailLogs(res.emailLogs || []);
          }
        } catch (e: any) {
          console.error("Failed to load Email settings", e);
        } finally {
          setEmailLoading(false);
        }
      };

      const fetchSupabaseSettings = async () => {
        setSupabaseLoading(true);
        try {
          const res = await safeFetchJson<any>("/api/settings/supabase");
          if (res.success && res.supabaseConfig) {
            setSupabaseUrl(res.supabaseConfig.url || "");
            setSupabaseSecretKey(res.supabaseConfig.secretKey || "");
            setSupabaseEnabled(!!res.supabaseConfig.enabled);
          }
        } catch (e: any) {
          console.error("Failed to load Supabase settings", e);
        } finally {
          setSupabaseLoading(false);
        }
      };

      fetchEmailSettings();
      fetchSupabaseSettings();
    }
  }, [activeTab]);



  const handleSaveEmailSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailSaving(true);
    setEmailSaveSuccess(null);
    setEmailSaveError(null);
    try {
      const res = await safeFetchJson<any>("/api/settings/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: emailEnabled,
          email: emailAddress,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpSecure
        })
      });
      if (res.success) {
        setEmailSaveSuccess("تم حفظ إعدادات تنبيهات البريد الإلكتروني بنجاح!");
        setTimeout(() => setEmailSaveSuccess(null), 4000);
      } else {
        setEmailSaveError(res.error || "فشل حفظ الإعدادات");
      }
    } catch (err: any) {
      setEmailSaveError(err.message || "فشل الاتصال بالخادم لحفظ الإعدادات");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleTestEmailMessage = async () => {
    setEmailTesting(true);
    setEmailTestSuccess(null);
    setEmailTestError(null);
    try {
      const res = await safeFetchJson<any>("/api/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailAddress,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpSecure
        })
      });
      if (res.success) {
        if (res.result?.mode === "log_only") {
          setEmailTestSuccess("تمت محاكاة التنبيه بنجاح لعدم توفر خادم بريد SMTP. (يرجى إدخال بيانات SMTP الخاصة بك للاختبار السحابي الفعلي).");
        } else {
          setEmailTestSuccess("تم إرسال بريد إلكتروني تجريبي بنجاح!");
        }
        setTimeout(() => setEmailTestSuccess(null), 5000);
        
        // Refresh email settings & logs
        const updatedSettings = await safeFetchJson<any>("/api/settings/email");
        if (updatedSettings.success && updatedSettings.emailLogs) {
          setEmailLogs(updatedSettings.emailLogs);
        }
      } else {
        setEmailTestError(res.error || "فشل إرسال بريد الاختبار");
      }
    } catch (err: any) {
      setEmailTestError(err.message || "فشل إرسال بريد الاختبار عبر الخادم");
    } finally {
      setEmailTesting(false);
    }
  };

  const handleSaveSupabaseSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSupabaseSaving(true);
    setSupabaseSaveSuccess(null);
    setSupabaseSaveError(null);
    const trimmedUrl = supabaseUrl.trim();
    const trimmedKey = supabaseSecretKey.trim();
    setSupabaseUrl(trimmedUrl);
    setSupabaseSecretKey(trimmedKey);
    try {
      const res = await safeFetchJson<any>("/api/settings/supabase", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          secretKey: trimmedKey,
          enabled: supabaseEnabled
        })
      });
      if (res.success) {
        setSupabaseSaveSuccess("تم حفظ إعدادات Supabase وتحديث قاعدة البيانات بنجاح!");
        setTimeout(() => setSupabaseSaveSuccess(null), 4000);
      } else {
        setSupabaseSaveError(res.error || "فشل حفظ الإعدادات");
      }
    } catch (err: any) {
      setSupabaseSaveError(err.message || "فشل الاتصال بالخادم لحفظ الإعدادات");
    } finally {
      setSupabaseSaving(false);
    }
  };

  const handleTestSupabaseConnection = async () => {
    setSupabaseTesting(true);
    setSupabaseTestSuccess(null);
    setSupabaseTestError(null);
    const trimmedUrl = supabaseUrl.trim();
    const trimmedKey = supabaseSecretKey.trim();
    setSupabaseUrl(trimmedUrl);
    setSupabaseSecretKey(trimmedKey);
    try {
      const res = await safeFetchJson<any>("/api/settings/supabase/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          secretKey: trimmedKey
        })
      });
      if (res.success) {
        if (res.warning) {
          setSupabaseTestSuccess(`⚠️ ${res.warning}`);
        } else {
          setSupabaseTestSuccess(res.message || "تم الاتصال بـ Supabase بنجاح!");
        }
        setTimeout(() => setSupabaseTestSuccess(null), 8000);
      } else {
        setSupabaseTestError(res.error || "فشل الاتصال بـ Supabase");
      }
    } catch (err: any) {
      setSupabaseTestError(err.message || "فشل الاتصال عبر الخادم");
    } finally {
      setSupabaseTesting(false);
    }
  };

  const handleDeleteSupabaseConfig = async () => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف إعدادات Supabase الحالية وإيقاف الاتصال بها والعودة للملف المحلي؟")) {
      return;
    }
    setSupabaseSaving(true);
    setSupabaseSaveSuccess(null);
    setSupabaseSaveError(null);
    try {
      const res = await safeFetchJson<any>("/api/settings/supabase", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "",
          secretKey: "",
          enabled: false
        })
      });
      if (res.success) {
        setSupabaseUrl("");
        setSupabaseSecretKey("");
        setSupabaseEnabled(false);
        setSupabaseSaveSuccess("تم حذف إعدادات واتصال Supabase القديم بنجاح والرجوع لقاعدة البيانات المحلية.");
        setTimeout(() => setSupabaseSaveSuccess(null), 4000);
      } else {
        setSupabaseSaveError(res.error || "فشل حذف الإعدادات");
      }
    } catch (err: any) {
      setSupabaseSaveError(err.message || "فشل الاتصال بالخادم لحذف الإعدادات");
    } finally {
      setSupabaseSaving(false);
    }
  };

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

  const handleTestPlatformConnection = async (platform: "safka" | "custom") => {
    setTestingPlatform(platform);
    setTestResult(null);
    try {
      const payload = await safeFetchJson<any>(`/api/platforms/${platform}/test`, { method: "POST" });
      setTestResult({
        platform,
        success: payload.success,
        responseTimeMs: payload.responseTimeMs,
        productsDetected: payload.productsDetected,
        sample: payload.sample,
        error: payload.error
      });
    } catch (e: any) {
      setTestResult({
        platform,
        success: false,
        error: `خطأ اتصال: ${e.message || String(e)}`
      });
    } finally {
      setTestingPlatform(null);
    }
  };

  const renderSettings = () => {
    return (
      <div className="space-y-6">
        
        {/* API Connectivity & Active Channels Status Indicator */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
          <div className="border-b border-[#20324A]/60 pb-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Wifi className="w-4.5 h-4.5 text-[#2F80FF]" />
              حالة اتصال قنوات تزويد الكتالوج والـ API (Settings Connectivity)
            </h3>
            <p className="text-[10px] text-[#9FB0C5] mt-1">تتبع فوري لحالة واستقرار خطوط الاتصال بـ API الموردين وفحص الاستجابة واللقطات الفعلي</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(connections.length > 0 ? connections : [
              { id: "safka", platform: "safka", displayName: "منصة صفقة الرسمية (Safka EG)", isActive: true, baseUrl: "https://api.safka-eg.com", productsEndpoint: "/api/v1/public/products", lastConnectionStatus: "SUCCESS", lastConnectionTestAt: null },
              { id: "custom", platform: "custom", displayName: "قناة كتالوج مخصصة", isActive: false, baseUrl: "https://api-custom-eg.com", productsEndpoint: "/api/inventory", lastConnectionStatus: "UNKNOWN", lastConnectionTestAt: null }
            ]).map((conn) => {
              const isSuccess = conn.lastConnectionStatus === "SUCCESS";
              const isTestingThis = testingPlatform === conn.platform;
              const hasTestResult = testResult && testResult.platform === conn.platform;
              
              return (
                <div key={conn.id} className="bg-[#07111F] border border-[#20324A]/50 p-5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-start border-b border-[#20324A]/30 pb-3">
                    <div>
                      <span className="font-extrabold text-white text-xs block">{conn.displayName || (conn.platform === "safka" ? "منصة صفقة Safka" : "قناة مخصصة")}</span>
                      <span className="text-[9px] text-[#9FB0C5] block font-mono mt-0.5">{conn.baseUrl}</span>
                    </div>
                    <div className="relative group flex items-center">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1.5 border select-none transition-all ${
                        isSuccess 
                          ? "bg-[#24C78E]/10 text-[#24C78E] border-[#24C78E]/20" 
                          : "bg-[#F05252]/10 text-[#F05252] border-[#F05252]/20 animate-pulse cursor-help"
                      }`}>
                        {isSuccess ? (
                          <>
                            <span>متصل ومستقر</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#24C78E]" />
                          </>
                        ) : (
                          <>
                            <span>فشل الربط</span>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F05252] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F05252]"></span>
                            </span>
                          </>
                        )}
                      </span>
                      
                      {!isSuccess && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-[#12233A] border border-[#F05252]/30 p-3.5 rounded-2xl shadow-2xl text-[11px] text-right text-red-100 min-w-[240px] pointer-events-none">
                          <div className="font-extrabold text-[#F05252] mb-1.5 flex items-center gap-1.5 justify-end">
                            <span>سبب انقطاع الـ API</span>
                            <AlertCircle className="w-3.5 h-3.5" />
                          </div>
                          <p className="leading-relaxed font-sans text-[11px] text-[#F3F4F6]">
                            {conn.lastConnectionError || "فشل الاتصال: لم يقم النظام بفحص الاستجابة بنجاح أو مفتاح الـ API الخاص بالمنصة غير صالح أو معطل."}
                          </p>
                          <div className="text-[9px] text-[#9FB0C5]/70 mt-2.5 pt-2 border-t border-[#20324A]/40 text-left font-mono">
                            {conn.lastConnectionTestAt ? `آخر فحص: ${formatTimeArabic(conn.lastConnectionTestAt)}` : "لم يتم الفحص بعد"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-[11px] text-[#9FB0C5]">
                    <div className="flex justify-between">
                      <span>عنوان مسار الجلب:</span>
                      <strong className="text-white font-mono">{conn.productsEndpoint}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>آخر فحص استجابة:</span>
                      <strong className="text-white">
                        {conn.lastConnectionTestAt ? formatTimeArabic(conn.lastConnectionTestAt) : "لم يتم الفحص المباشر"}
                      </strong>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => handleTestPlatformConnection(conn.platform as any)}
                      disabled={testingPlatform !== null}
                      className="px-3 py-1.5 bg-[#12233A] hover:bg-[#20324A] text-[10px] font-bold text-white rounded-lg border border-[#20324A] transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isTestingThis ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-[#2F80FF]" />
                      ) : (
                        <Wifi className="w-3 h-3 text-[#2F80FF]" />
                      )}
                      <span>اختبار استجابة الـ API</span>
                    </button>
                    
                    {isSuccess && (
                      <span className="text-[10px] text-[#24C78E] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        الترخيص فعال
                      </span>
                    )}
                  </div>

                  {hasTestResult && testResult && (
                    <div className={`p-3 rounded-xl border text-[10px] space-y-1 ${
                      testResult.success 
                        ? "bg-[#24C78E]/5 border-[#24C78E]/20 text-emerald-400" 
                        : "bg-[#F05252]/5 border-[#F05252]/20 text-red-400"
                    }`}>
                      {testResult.success ? (
                        <>
                          <div className="font-extrabold">✓ نجح الاتصال الفعلي بالـ API!</div>
                          <div>زمن الاستجابة: <span className="font-mono">{testResult.responseTimeMs}ms</span></div>
                          {testResult.productsDetected !== undefined && (
                            <div>المنتجات المكتشفة بالصفحة الأولى: <span className="font-mono">{testResult.productsDetected}</span></div>
                          )}
                          {testResult.sample && (
                            <div className="truncate text-white/85 mt-0.5">عينة: {testResult.sample.name} ({testResult.sample.sku})</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="font-extrabold">⚠ فشل فحص الاستجابة:</div>
                          <div className="leading-relaxed text-red-300">{testResult.error || "خطأ غير معروف"}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Core parameters settings */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
          <div className="border-b border-[#20324A]/60 pb-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sliders className="w-4.5 h-4.5 text-[#2F80FF]" />
              التحكم في معايير الرصد الدوري وفترات التحقق
            </h3>
            <p className="text-[10px] text-[#9FB0C5] mt-1">ضبط الفترات التكرارية لخوادم ستوك رادار والحدود الأمنية لإمدادات المخازن</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#9FB0C5]">الفترة الزمنية للمزامنة التلقائية لصفقة (دقيقة)</label>
              <input 
                type="number" 
                defaultValue={10} 
                className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#9FB0C5]">عتبة التحذير للمنتجات قريبة النفاد (قطعة)</label>
              <input 
                type="number" 
                defaultValue={20} 
                className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Email Real-time Stock Alerts via SMTP / Server */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
          <div className="border-b border-[#20324A]/60 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Mail className="w-4.5 h-4.5 text-[#2F80FF]" />
                نظام تنبيهات البريد الإلكتروني اللحظية (SMTP)
              </h3>
              <p className="text-[10px] text-[#9FB0C5] mt-1">
                إرسال تنبيهات بريدية فورية مباشرة إلى بريدك الإلكتروني عند انخفاض مخزون أي منتج بنسبة تزيد عن 50% خلال ساعة واحدة.
              </p>
            </div>
            
            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={emailEnabled} 
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#07111F] border border-[#20324A] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-[#9FB0C5] after:border-[#20324A] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2F80FF]/20 peer-checked:after:bg-[#2F80FF] peer-checked:border-[#2F80FF]/30"></div>
              <span className="mr-3 text-xs font-bold text-white select-none">
                {emailEnabled ? "نشط" : "معطل"}
              </span>
            </label>
          </div>

          {emailLoading ? (
            <div className="py-6 text-center text-xs text-[#9FB0C5] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#2F80FF]" />
              <span>جاري تحميل إعدادات البريد الإلكتروني...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveEmailSettings} className="space-y-5">
              {emailEnabled && (
                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-2 text-right">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5 justify-end">
                    <span>💡 دليل إعداد الإرسال الفعلي عبر بريد Gmail أو Outlook</span>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                  </h4>
                  <p className="text-[10px] text-[#9FB0C5] leading-relaxed">
                    إذا تركت الحقول أدناه فارغة، سيقوم التطبيق بـ <strong className="text-white">محاكاة إرسال التنبيه</strong> وتسجيله في لوحة المراقبة السفلية فقط بدون وصول بريد حقيقي لعلبتك. لتفعيل الإرسال الحقيقي بنسبة 100٪، اتبع الإعدادات التالية:
                  </p>
                  <ul className="text-[10px] text-[#9FB0C5] space-y-1 list-disc list-inside">
                    <li><strong>خادم SMTP لـ Gmail:</strong> <span className="font-mono text-white">smtp.gmail.com</span></li>
                    <li><strong>منفذ SMTP:</strong> <span className="font-mono text-white">587</span> (مع تعطيل خيار SSL الآمن) أو <span className="font-mono text-white">465</span> (مع تفعيل خيار SSL الآمن)</li>
                    <li><strong>اسم المستخدم:</strong> بريدك الإلكتروني كاملاً (مثال: <span className="font-mono text-white">example@gmail.com</span>)</li>
                    <li>
                      <strong>كلمة المرور الهامة جداً:</strong> يجب استخدام <strong className="text-yellow-400">كلمة مرور التطبيق (App Password)</strong> التي يتم توليدها من حساب جوجل الخاص بك (الأمان &gt; التحقق بخطوتين &gt; كلمات مرور التطبيقات)، <strong>ولن تعمل كلمة مرور بريدك المعتادة مطلقاً</strong> بسبب حماية جوجل.
                    </li>
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Email Address Input */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-[#9FB0C5] flex items-center gap-1.5 justify-end">
                    <span>البريد الإلكتروني المستلم للتنبيهات</span>
                    <Mail className="w-3.5 h-3.5 text-[#2F80FF]" />
                  </label>
                  <input 
                    type="email" 
                    value={emailAddress} 
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="مثال: ziadalwafa0@gmail.com"
                    required={emailEnabled}
                    className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 transition-all text-left"
                  />
                  <span className="text-[9px] text-[#9FB0C5]/70 block leading-tight">
                    تلقائياً سيتم إرسال كافة التنبيهات اللحظية إلى هذا العنوان.
                  </span>
                </div>

                {/* SMTP Host */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#9FB0C5]">خادم SMTP (SMTP Host)</label>
                  <input 
                    type="text" 
                    value={smtpHost} 
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="مثال: smtp.gmail.com"
                    className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 transition-all text-left"
                  />
                  <span className="text-[9px] text-[#9FB0C5]/70 block leading-tight">
                    اختياري. اتركه فارغاً للاعتماد على خادم المحاكاة التلقائي.
                  </span>
                </div>

                {/* SMTP Port */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#9FB0C5]">منفذ SMTP (Port)</label>
                  <input 
                    type="number" 
                    value={smtpPort} 
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    placeholder="مثال: 587 أو 465"
                    className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 transition-all text-left"
                  />
                </div>

                {/* SMTP User */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#9FB0C5]">اسم مستخدم SMTP (Username)</label>
                  <input 
                    type="text" 
                    value={smtpUser} 
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="مثال: user@gmail.com"
                    className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 transition-all text-left"
                  />
                </div>

                {/* SMTP Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#9FB0C5]">كلمة مرور SMTP (Password)</label>
                  <input 
                    type="password" 
                    value={smtpPass} 
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 transition-all text-left"
                  />
                </div>

                {/* Secure SSL/TLS */}
                <div className="space-y-1.5 md:col-span-2 flex items-center justify-between bg-[#07111F] p-3 rounded-xl border border-[#20324A]/40">
                  <span className="text-xs font-bold text-[#9FB0C5]">استخدام اتصال آمن ومحمي SSL/TLS</span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={smtpSecure} 
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#0D1B2D] border border-[#20324A] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-[#9FB0C5] after:border-[#20324A] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2F80FF]/20 peer-checked:after:bg-[#2F80FF] peer-checked:border-[#2F80FF]/30"></div>
                  </label>
                </div>
              </div>

              {/* Status notifications */}
              {(emailSaveSuccess || emailSaveError || emailTestSuccess || emailTestError) && (
                <div className="space-y-2 mt-2 text-xs">
                  {emailSaveSuccess && (
                    <div className="p-3.5 bg-[#24C78E]/10 border border-[#24C78E]/20 text-[#24C78E] rounded-xl flex items-center gap-2 justify-end">
                      <span>{emailSaveSuccess}</span>
                      <CircleCheck className="w-4 h-4 shrink-0 animate-bounce" />
                    </div>
                  )}
                  {emailSaveError && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 justify-end">
                      <span>{emailSaveError}</span>
                      <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                    </div>
                  )}
                  {emailTestSuccess && (
                    <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center gap-2 justify-end">
                      <span>{emailTestSuccess}</span>
                      <CircleCheck className="w-4 h-4 shrink-0 animate-bounce" />
                    </div>
                  )}
                  {emailTestError && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 justify-end">
                      <span>{emailTestError}</span>
                      <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                    </div>
                  )}
                </div>
              )}

              {/* Form buttons */}
              <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-[#20324A]/40">
                <button
                  type="button"
                  onClick={handleTestEmailMessage}
                  disabled={emailTesting || emailSaving}
                  className="px-5 h-11 bg-[#12233A] hover:bg-[#20324A] text-xs font-bold text-[#9FB0C5] hover:text-white rounded-xl border border-[#20324A] transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {emailTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2F80FF]" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-[#2F80FF]" />
                  )}
                  <span>إرسال بريد تجريبي (Test Email)</span>
                </button>

                <button
                  type="submit"
                  disabled={emailSaving || emailTesting}
                  className="px-6 h-11 bg-[#2F80FF] hover:bg-[#1A68D9] text-xs font-black text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#2F80FF]/10"
                >
                  {emailSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <CircleCheck className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>حفظ إعدادات البريد الإلكتروني</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Supabase Cloud Connection & Sync Configuration */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
          <div className="border-b border-[#20324A]/60 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2 justify-end">
                <Database className="w-4.5 h-4.5 text-[#2F80FF]" />
                مزامنة واتصال قاعدة بيانات Supabase (السحابة)
              </h3>
              <p className="text-[10px] text-[#9FB0C5] mt-1">
                اربط مشروعك بمشروع قاعدة بيانات Supabase الجديد لتخزين المنتجات، التنبيهات، والعمليات سحابياً بدلاً من التخزين المحلي.
              </p>
            </div>
            
            {/* Toggle switch */}
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={supabaseEnabled} 
                onChange={(e) => setSupabaseEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#07111F] border border-[#20324A] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-[#9FB0C5] after:border-[#20324A] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2F80FF]/20 peer-checked:after:bg-[#2F80FF] peer-checked:border-[#2F80FF]/30"></div>
              <span className="mr-3 text-xs font-bold text-white select-none">
                {supabaseEnabled ? "نشط ومفعل" : "غير مفعل (محلي)"}
              </span>
            </label>
          </div>

          {supabaseLoading ? (
            <div className="py-6 text-center text-xs text-[#9FB0C5] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#2F80FF]" />
              <span>جاري تحميل إعدادات Supabase...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveSupabaseSettings} className="space-y-5">
              <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl space-y-2 text-right">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5 justify-end">
                  <span>💡 تنبيه أمان هام بخصوص المفاتيح والجداول</span>
                  <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
                </h4>
                <p className="text-[10px] text-[#9FB0C5] leading-relaxed">
                  عند الانتقال لمشروع Supabase جديد، يرجى ملء الحقول أدناه وحفظ الإعدادات. تأكد من أن المشروع الجديد يحتوي على الجداول المحددة مسبقاً في المخطط (مثل <code className="text-white font-mono bg-white/5 px-1 rounded">products</code>, <code className="text-white font-mono bg-white/5 px-1 rounded">inventory_snapshots</code>, <code className="text-white font-mono bg-white/5 px-1 rounded">sync_runs</code>, و <code className="text-white font-mono bg-white/5 px-1 rounded">platform_connections</code>) ليعمل الرصد بنجاح.
                </p>
                <p className="text-[10px] text-yellow-400/90 leading-relaxed font-bold">
                  * يجب استخدام مفتاح "Service Role Key" أو مفتاح السر الفائق (وليس Anon Key) لتجاوز سياسات RLS ومزامنة البيانات في الخلفية بدون مشاكل صلاحيات.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Supabase URL Input */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-[#9FB0C5] flex items-center gap-1.5 justify-end">
                    <span>رابط مشروع Supabase الجديد (Supabase URL)</span>
                    <Code className="w-3.5 h-3.5 text-[#2F80FF]" />
                  </label>
                  <input 
                    type="url" 
                    value={supabaseUrl} 
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="مثال: https://abcdefghijklm.supabase.co"
                    required={supabaseEnabled}
                    className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 transition-all text-left"
                  />
                </div>

                {/* Supabase Secret Key Input */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-[#9FB0C5] flex items-center gap-1.5 justify-end">
                    <span>مفتاح السر السري لـ Supabase (Service Role Secret Key)</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2F80FF]" />
                  </label>
                  <input 
                    type="password" 
                    value={supabaseSecretKey} 
                    onChange={(e) => setSupabaseSecretKey(e.target.value)}
                    placeholder="أدخل مفتاح الخدمة السري الفائق الفعالية لربط السحابة"
                    required={supabaseEnabled}
                    className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 transition-all text-left"
                  />
                </div>
              </div>

              {/* Status notifications */}
              {(supabaseSaveSuccess || supabaseSaveError || supabaseTestSuccess || supabaseTestError) && (
                <div className="space-y-2 mt-2 text-xs">
                  {supabaseSaveSuccess && (
                    <div className="p-3.5 bg-[#24C78E]/10 border border-[#24C78E]/20 text-[#24C78E] rounded-xl flex items-center gap-2 justify-end">
                      <span>{supabaseSaveSuccess}</span>
                      <CircleCheck className="w-4 h-4 shrink-0 animate-bounce" />
                    </div>
                  )}
                  {supabaseSaveError && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 justify-end">
                      <span>{supabaseSaveError}</span>
                      <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                    </div>
                  )}
                  {supabaseTestSuccess && (
                    <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center gap-2 justify-end">
                      <span>{supabaseTestSuccess}</span>
                      <CircleCheck className="w-4 h-4 shrink-0 animate-bounce" />
                    </div>
                  )}
                  {supabaseTestError && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 justify-end">
                      <span>{supabaseTestError}</span>
                      <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                    </div>
                  )}
                </div>
              )}

              {/* Form buttons */}
              <div className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 pt-3 border-t border-[#20324A]/40">
                <div className="flex flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleTestSupabaseConnection}
                    disabled={supabaseTesting || supabaseSaving}
                    className="px-5 h-11 bg-[#12233A] hover:bg-[#20324A] text-xs font-bold text-[#9FB0C5] hover:text-white rounded-xl border border-[#20324A] transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {supabaseTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2F80FF]" />
                    ) : (
                      <Wifi className="w-3.5 h-3.5 text-[#2F80FF]" />
                    )}
                    <span>اختبار الاتصال (Test)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSupabaseConfig}
                    disabled={supabaseTesting || supabaseSaving || (!supabaseUrl && !supabaseSecretKey)}
                    className="px-4 h-11 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 rounded-xl border border-red-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>حذف وحل الاتصال القديم</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={supabaseSaving || supabaseTesting}
                  className="px-6 h-11 bg-[#2F80FF] hover:bg-[#1A68D9] text-xs font-black text-white rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#2F80FF]/10"
                >
                  {supabaseSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <CircleCheck className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>حفظ وتنشيط السحابة الجديدة</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Email Logs Diagnostic Audit Board */}
        {emailLogs && emailLogs.length > 0 && (
          <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-4 text-right">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <History className="w-4.5 h-4.5 text-blue-400" />
                سجل إرسال التنبيهات البريدية الفعلي والمحاكي
              </h3>
              <p className="text-[10px] text-[#9FB0C5] mt-1">تتبع حالة تسليم التنبيهات للبريد الإلكتروني دقيقة بدقيقة مع التفاصيل الفنية للأعطال</p>
            </div>

            <div className="bg-[#07111F] border border-[#20324A]/50 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-[#12233A]/80 border-b border-[#20324A] text-[#9FB0C5] font-bold">
                      <th className="px-4 py-3 text-right">الوقت</th>
                      <th className="px-4 py-3 text-right">المستلم</th>
                      <th className="px-4 py-3 text-right">عنوان التنبيه</th>
                      <th className="px-4 py-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#20324A]/40">
                    {emailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#12233A]/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-[10px] text-[#9FB0C5] whitespace-nowrap">
                          {formatTimeArabic(log.sentAt)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-white">
                          {log.to}
                        </td>
                        <td className="px-4 py-2.5 text-[#9FB0C5] max-w-[200px] truncate">
                          {log.subject}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              log.status === "success"
                                ? "bg-[#24C78E]/10 text-[#24C78E]"
                                : log.status === "logged_only"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-red-500/10 text-red-400"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                log.status === "success" 
                                  ? "bg-[#24C78E]" 
                                  : log.status === "logged_only"
                                  ? "bg-blue-400"
                                  : "bg-red-500 animate-pulse"
                              }`} />
                              {log.status === "success" 
                                ? "تم الإرسال الفعلي" 
                                : log.status === "logged_only" 
                                ? "محاكاة (بدون SMTP)" 
                                : "فشل الإرسال"}
                            </span>
                            {log.error && (
                              <span className="text-[8px] text-red-400/80 font-mono block max-w-[150px] truncate" title={log.error}>
                                {log.error}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 24/7 Automated Sync Guide */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
          <div className="border-b border-[#20324A]/60 pb-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-emerald-400" />
              تفعيل الرصد التلقائي 24/7 (حتى عند إغلاق اللاب توب أو المتصفح)
            </h3>
            <p className="text-[10px] text-[#9FB0C5] mt-1">كيفية تفعيل الرصد وجلب البيانات بدقة 100٪ وبدون انقطاع</p>
          </div>

          <div className="bg-[#07111F] border border-[#20324A]/50 p-5 rounded-2xl space-y-4 text-right">
            <p className="text-xs text-[#9FB0C5] leading-relaxed">
              بما أن تطبيق <strong className="text-white">ستوك رادار</strong> يعمل بالكامل على خوادم سحابية (Cloud Server)، فإن الخادم يتوقف مؤقتاً لتوفير الطاقة وموارد التشغيل عندما لا يكون هناك زوار نشطين للموقع (مثال: عند إغلاق اللاب توب أو إغلاق المتصفح).
            </p>
            <p className="text-xs text-[#9FB0C5] leading-relaxed">
              لضمان استمرار رصد المخزون وحساب سحب القطع بدقة <span className="text-[#24C78E] font-bold">100٪ على مدار الساعة دون توقف</span>، نوصي بربط رابط المزامنة بخدمة استدعاء مجانية (Cron Job) تقوم بتنشيط وفحص مخازن الموردين تلقائياً كل 20 دقيقة.
            </p>

            <div className="bg-[#12233A] border border-[#20324A] p-4 rounded-xl space-y-3">
              <h4 className="text-xs font-black text-white">خطوات التفعيل البسيطة (مجانية تماماً):</h4>
              <ol className="list-decimal list-inside text-[11px] text-[#9FB0C5] space-y-2 leading-relaxed">
                <li>قم بزيارة موقع <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-[#2F80FF] font-bold underline hover:text-[#24C78E]">Cron-Job.org</a> أو <a href="https://uptimerobot.com" target="_blank" rel="noreferrer" className="text-[#2F80FF] font-bold underline hover:text-[#24C78E]">UptimeRobot.com</a> وسجل حساباً مجانياً.</li>
                <li>اضغط على إنشاء مهمة جديدة <strong className="text-white">(Create Cron Job / Monitor)</strong>.</li>
                <li>انسخ الرابط التالي وضعه في خانة العنوان (URL):
                  <div className="bg-[#07111F] border border-[#20324A] p-2.5 rounded-lg mt-1.5 font-mono text-[10px] text-[#24C78E] select-all break-all text-left">
                    {`${typeof window !== "undefined" ? window.location.origin : "https://ais-pre-u3proz3yka4qier5sdp6lw-624285787849.europe-west2.run.app"}/api/platforms/safka/sync?force=true`}
                  </div>
                </li>
                <li>اختر طريقة الاستدعاء لتكون <strong className="text-white">POST</strong> (أو GET وسيقوم النظام بتفعيل المزامنة تلقائياً).</li>
                <li>اضبط التكرار على <strong className="text-white">كل 20 دقيقة (Every 20 minutes)</strong> لضمان تحديث مستمر.</li>
              </ol>
            </div>
            
            <div className="text-[11px] text-[#24C78E] flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#24C78E] animate-ping" />
              <span>بمجرد ضبط الكرون الخارجي، سيعمل النظام بشكل مستقل تماماً وستحصل على دقة رصد 100٪ بدون انقطاع!</span>
            </div>
          </div>
        </div>

        {/* Recent Activity Logs section (Audit logs) */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
          <div className="border-b border-[#20324A]/60 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-[#2F80FF]" />
                سجل الأنشطة الأخيرة وتدقيق النظام (Platform Audit Log)
              </h3>
              <p className="text-[10px] text-[#9FB0C5] mt-1">تتبع ومراجعة عمليات المزامنة اليدوية، تغييرات التكوين، وتواريخ تسجيل دخول المشرفين</p>
            </div>
            
            <button
              onClick={() => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activityLogs, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `audit_log_${new Date().toISOString().slice(0, 10)}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              className="px-4 py-2 bg-[#1B2A3E] hover:bg-[#25374E] text-[11px] font-bold text-white rounded-xl transition flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#2F80FF]" />
              <span>تصدير السجل الكامل (JSON)</span>
            </button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="البحث في الأنشطة، الإجراءات، أو المستخدمين..."
                value={activitySearchQuery}
                onChange={(e) => setActivitySearchQuery(e.target.value)}
                className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl pr-10 pl-4 text-xs text-white placeholder-[#5F758F] outline-none focus:border-[#2F80FF]/50 transition text-right"
              />
              <Search className="absolute right-3.5 top-3.5 w-4 h-4 text-[#5F758F]" />
            </div>

            {/* Filter Buttons */}
            <div className="flex bg-[#07111F] border border-[#20324A] rounded-xl p-1 gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActivityTypeFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activityTypeFilter === "all" 
                    ? "bg-[#2F80FF] text-white" 
                    : "text-[#9FB0C5] hover:text-white"
                }`}
              >
                الكل ({activityLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setActivityTypeFilter("sync")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activityTypeFilter === "sync" 
                    ? "bg-[#2F80FF] text-white" 
                    : "text-[#9FB0C5] hover:text-white"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                مزامنة ({activityLogs.filter(l => l.type === "sync").length})
              </button>
              <button
                type="button"
                onClick={() => setActivityTypeFilter("config")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activityTypeFilter === "config" 
                    ? "bg-[#2F80FF] text-white" 
                    : "text-[#9FB0C5] hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                إعدادات ({activityLogs.filter(l => l.type === "config").length})
              </button>
              <button
                type="button"
                onClick={() => setActivityTypeFilter("login")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activityTypeFilter === "login" 
                    ? "bg-[#2F80FF] text-white" 
                    : "text-[#9FB0C5] hover:text-white"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                تسجيل الدخول ({activityLogs.filter(l => l.type === "login").length})
              </button>
            </div>
          </div>

          {/* Activities List */}
          <div className="bg-[#07111F] border border-[#20324A]/50 rounded-2xl overflow-hidden">
            {activityLogs.filter(log => {
              const matchesSearch = 
                log.action.toLowerCase().includes(activitySearchQuery.toLowerCase()) ||
                log.details.toLowerCase().includes(activitySearchQuery.toLowerCase()) ||
                (log.user && log.user.toLowerCase().includes(activitySearchQuery.toLowerCase()));
              
              const matchesFilter = activityTypeFilter === "all" || log.type === activityTypeFilter;
              
              return matchesSearch && matchesFilter;
            }).length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Activity className="w-10 h-10 text-[#5F758F] mx-auto opacity-40" />
                <p className="text-xs text-[#9FB0C5]">لم يتم العثور على أي أنشطة مطابقة لمعايير البحث الحالية.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#20324A]/40 max-h-[320px] overflow-y-auto custom-scrollbar">
                {activityLogs.filter(log => {
                  const matchesSearch = 
                    log.action.toLowerCase().includes(activitySearchQuery.toLowerCase()) ||
                    log.details.toLowerCase().includes(activitySearchQuery.toLowerCase()) ||
                    (log.user && log.user.toLowerCase().includes(activitySearchQuery.toLowerCase()));
                  
                  const matchesFilter = activityTypeFilter === "all" || log.type === activityTypeFilter;
                  
                  return matchesSearch && matchesFilter;
                }).map((log) => {
                  const logDate = new Date(log.timestamp);
                  const formattedTime = logDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                  const formattedDate = logDate.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
                  
                  return (
                    <div 
                      key={log.id} 
                      className={`p-4 hover:bg-[#0D1B2D]/40 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                        selectedActivity?.id === log.id ? "bg-[#2F80FF]/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Type Icon Badge */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          log.type === "sync" 
                            ? "bg-[#24C78E]/10 text-[#24C78E]" 
                            : log.type === "config"
                              ? "bg-[#FF9F43]/10 text-[#FF9F43]"
                              : "bg-[#2F80FF]/10 text-[#2F80FF]"
                        }`}>
                          {log.type === "sync" && <RefreshCw className="w-4.5 h-4.5" />}
                          {log.type === "config" && <Sliders className="w-4.5 h-4.5" />}
                          {log.type === "login" && <User className="w-4.5 h-4.5" />}
                        </div>

                        {/* Title, User, Details */}
                        <div className="space-y-1 text-right">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-white text-xs">{log.action}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1B2A3E] text-[#9FB0C5] font-mono">
                              {log.type === "sync" ? "مزامنة" : log.type === "config" ? "إعدادات" : "دخول"}
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-[#9FB0C5] leading-relaxed max-w-2xl">{log.details}</p>
                          
                          <div className="flex items-center gap-3 text-[10px] text-[#5F758F]">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-[#2F80FF]/80" />
                              <span>المسؤول: {log.user || "ziadalwafa0@gmail.com"}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Date & Time / View button */}
                      <div className="flex items-center justify-between md:justify-end w-full md:w-auto shrink-0 gap-4 border-t border-[#20324A]/30 md:border-t-0 pt-3 md:pt-0">
                        <div className="text-right">
                          <span className="text-[11px] font-bold text-white block font-mono">{formattedTime}</span>
                          <span className="text-[9px] text-[#5F758F] block font-mono mt-0.5">{formattedDate}</span>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => setSelectedActivity(selectedActivity?.id === log.id ? null : log)}
                          className="p-1.5 bg-[#1B2A3E] hover:bg-[#2F80FF]/20 text-[#9FB0C5] hover:text-[#2F80FF] rounded-lg transition cursor-pointer"
                          title="عرض تفاصيل المدخلة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity Detail Modal / Panel if selected */}
          {selectedActivity && (
            <div className="bg-[#1B2A3E]/30 border border-[#2F80FF]/30 p-5 rounded-2xl space-y-4 text-right animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#20324A] pb-3">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2F80FF]" />
                  تفاصيل سجل الحركة المدقق #{selectedActivity.id}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="text-xs font-bold text-[#F05252] hover:underline cursor-pointer"
                >
                  إغلاق التفاصيل
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 bg-[#07111F]/50 p-3 rounded-xl">
                  <span className="text-[10px] text-[#9FB0C5] block font-extrabold">الإجراء المنفذ</span>
                  <span className="text-white font-black">{selectedActivity.action}</span>
                </div>
                
                <div className="space-y-1 bg-[#07111F]/50 p-3 rounded-xl">
                  <span className="text-[10px] text-[#9FB0C5] block font-extrabold">نوع العملية</span>
                  <span className="text-[#2F80FF] font-black">
                    {selectedActivity.type === "sync" ? "مزامنة الكتالوجات" : selectedActivity.type === "config" ? "تغيير معايير النظام" : "تسجيل المشرفين"}
                  </span>
                </div>

                <div className="space-y-1 bg-[#07111F]/50 p-3 rounded-xl">
                  <span className="text-[10px] text-[#9FB0C5] block font-extrabold">المستخدم المنفذ</span>
                  <span className="text-white font-mono">{selectedActivity.user || "ziadalwafa0@gmail.com"}</span>
                </div>

                <div className="space-y-1 bg-[#07111F]/50 p-3 rounded-xl">
                  <span className="text-[10px] text-[#9FB0C5] block font-extrabold">تاريخ العملية</span>
                  <span className="text-white font-mono">{new Date(selectedActivity.timestamp).toLocaleString("ar-EG")}</span>
                </div>

                <div className="space-y-1 bg-[#07111F]/50 p-3 rounded-xl md:col-span-2">
                  <span className="text-[10px] text-[#9FB0C5] block font-extrabold">وصف التغيير التفصيلي والتدقيق</span>
                  <p className="text-white leading-relaxed whitespace-pre-wrap">{selectedActivity.details}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Database parameters reset */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
          <div className="border-b border-[#20324A]/60 pb-4">
            <h3 className="text-sm font-bold text-[#F05252] flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-[#F05252]" />
              منطقة الصيانة وإعادة تعيين قواعد البيانات
            </h3>
            <p className="text-[10px] text-[#9FB0C5] mt-1">مسح الكتالوج العام وسجلات الحركة بالكامل والبدء بمستندات فارغة</p>
          </div>

          <div className="bg-[#F05252]/5 border border-[#F05252]/20 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F05252] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-[#F05252]">تحذير أمني خطير لا يمكن التراجع عنه!</h4>
              <p className="text-[11px] text-[#9FB0C5] leading-relaxed">
                سيؤدي الضغط على الزر أدناه إلى تصفير كافة المنتجات المخزنة، حذف اللقطات، إزالة سجلات المزامنة التاريخية، وتعطيل بوابات الربط. ستحتاج إلى إعادة إدخال مفتاح الـ API والبدء في سحب الكتالوج من الصفر.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onResetDatabase}
              className="px-6 h-11 bg-[#F05252] hover:bg-[#F27474] text-xs font-black text-white rounded-xl transition cursor-pointer shadow-lg shadow-[#F05252]/10 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>إعادة تعيين ومسح قاعدة البيانات تماماً</span>
            </button>
          </div>
        </div>

      </div>
    );
  };

  return activeTab === "history" ? <DiagnosticLogsViewer /> : renderSettings();
}
