// @ts-nocheck
import React from "react";
import { 
  Wifi, 
  Settings, 
  Database, 
  Lock, 
  CircleCheck, 
  CircleX, 
  RefreshCw, 
  CircleHelp,
  ShieldCheck,
  Globe,
  Radio
} from "lucide-react";
import { PlatformConnection } from "../types";

interface ConnectionsTabProps {
  connections: PlatformConnection[];
  selectedFormPlatform: "safka" | "custom";
  setSelectedFormPlatform: (p: "safka" | "custom") => void;
  formApiKeyHeader: string;
  setFormApiKeyHeader: (h: string) => void;
  formApiKey: string;
  setFormApiKey: (k: string) => void;
  formBaseUrl: string;
  setFormBaseUrl: (u: string) => void;
  formEndpoint: string;
  setFormEndpoint: (e: string) => void;
  testing: boolean;
  onTestConnection: () => void;
  onSaveConnection: () => void;
}

export default function ConnectionsTab({
  connections,
  selectedFormPlatform,
  setSelectedFormPlatform,
  formApiKeyHeader,
  setFormApiKeyHeader,
  formApiKey,
  setFormApiKey,
  formBaseUrl,
  setFormBaseUrl,
  formEndpoint,
  setFormEndpoint,
  testing,
  onTestConnection,
  onSaveConnection
}: ConnectionsTabProps) {

  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Platform Connection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {connections.map((conn) => {
          const lastSuccessStr = conn.last_successful_sync_at;
          const intervalMins = conn.monitoring_interval_minutes || 20;
          const expectedIntervalSecs = intervalMins * 60;
          
          let elapsedSecs = -1;
          let isOverdue = false;
          let elapsedText = "لا توجد مزامنة ناجحة بعد";
          
          if (lastSuccessStr) {
            const lastSuccessDate = new Date(lastSuccessStr);
            elapsedSecs = Math.max(0, Math.floor((now.getTime() - lastSuccessDate.getTime()) / 1000));
            isOverdue = elapsedSecs > expectedIntervalSecs;
            
            const mins = Math.floor(elapsedSecs / 60);
            const secs = elapsedSecs % 60;
            if (mins === 0) {
              elapsedText = `منذ ${secs} ثانية`;
            } else {
              elapsedText = `منذ ${mins} دقيقة و ${secs} ثانية`;
            }
          }

          const isActive = conn.isActive;

          return (
            <div 
              key={conn.id} 
              className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-2xl text-right space-y-4 flex flex-col justify-between transition-all hover:border-[#2F80FF]/45"
            >
              <div>
                <div className="flex justify-between items-start border-b border-[#20324A]/40 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#2F80FF]/10 flex items-center justify-center text-[#2F80FF]">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <span className="font-extrabold text-white text-xs block">
                        {conn.platform === "safka" ? "منصة صفقة الرسمية (Safka EG)" : (conn.displayName || "قناة كتالوج مخصصة")}
                      </span>
                      <span className="text-[9px] text-[#9FB0C5] block font-mono">{conn.baseUrl || "غير مهيأ"}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-black ${
                    isActive ? "bg-[#24C78E]/15 text-[#24C78E]" : "bg-[#9FB0C5]/10 text-[#9FB0C5]"
                  }`}>
                    {isActive ? "نشط ومفعل 🟢" : "غير مفعل ⚪"}
                  </span>
                </div>

                <div className="space-y-2 text-[11px] text-[#9FB0C5] mt-3">
                  <div className="flex justify-between">
                    <span>حالة التراخيص والربط:</span>
                    <strong className="text-white">
                      {conn.lastConnectionStatus?.includes("CONNECTED") || conn.lastConnectionStatus === "SUCCESS" ? "مفتاح API صالح ونشط" : "غير متصل / غير مهيأ"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>دورة الرصد والمراقبة:</span>
                    <strong className="text-white font-mono">تلقائي (كل {intervalMins} دقائق)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>تحديث مخزن الكتالوج:</span>
                    <strong className="text-white">
                      {conn.last_sync_status === "COMPLETED" ? (
                        <span className="text-[#24C78E]">تأكيد ومطابقة ناجحة</span>
                      ) : conn.last_sync_status === "FAILED" ? (
                        <span className="text-[#EF4444]">فشلت آخر مزامنة</span>
                      ) : (
                        <span className="text-[#9FB0C5]">في انتظار أول مزامنة</span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Precise real-time elapsed sync indicator requested by user */}
              <div className={`mt-2 p-3 rounded-xl border flex items-center justify-between transition-all ${
                !lastSuccessStr 
                  ? "bg-[#07111F]/40 border-[#20324A]/40 text-[#9FB0C5]/80"
                  : isOverdue 
                    ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#F87171]" 
                    : "bg-[#24C78E]/10 border-[#24C78E]/30 text-[#34D399]"
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    !lastSuccessStr 
                      ? "bg-gray-500" 
                      : isOverdue 
                        ? "bg-[#EF4444] animate-ping" 
                        : "bg-[#24C78E] animate-pulse"
                  }`} />
                  <span className="text-[10px] font-black">آخر مزامنة ناجحة:</span>
                </div>
                <div className="text-left">
                  <span className="text-xs font-black font-mono leading-none block">
                    {elapsedText}
                  </span>
                  {lastSuccessStr && (
                    <span className="text-[8px] opacity-75 font-mono block mt-0.5">
                      {isOverdue 
                        ? `متأخرة! (تجاوزت ${intervalMins} دقيقة)` 
                        : `مزامنة مستقرة وآمنة`}
                    </span>
                  )}
                </div>
              </div>

            </div>
          );
        })}

      </div>

      {/* Connection Credentials Configuration Form */}
      <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6">
        <div className="border-b border-[#20324A]/60 pb-4">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Settings className="w-4.5 h-4.5 text-[#2F80FF]" />
            إعدادات ربط قنوات تزويد الكتالوج والـ API
          </h3>
          <p className="text-[10px] text-[#9FB0C5] mt-1">
            إدخال وتحديث مفتاح الربط وتراخيص الاتصال بمزود الخدمة للحصول على قراءات المخازن المباشرة
          </p>
        </div>

        {/* Form Selector Tabs */}
        <div className="flex bg-[#07111F] p-1 rounded-xl max-w-sm">
          <button 
            type="button"
            onClick={() => {
              setSelectedFormPlatform("safka");
              setFormApiKeyHeader("api-safka-key");
              setFormBaseUrl("https://api.safka-eg.com");
              setFormEndpoint("/api/v1/public/products");
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
              selectedFormPlatform === "safka" ? "bg-[#2F80FF] text-white" : "text-[#9FB0C5] hover:text-white"
            }`}
          >
            منصة صفقة Safka EG
          </button>
          <button 
            type="button"
            onClick={() => {
              setSelectedFormPlatform("custom");
              setFormApiKeyHeader("x-custom-key");
              setFormBaseUrl("https://api-custom-eg.com");
              setFormEndpoint("/api/inventory");
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
              selectedFormPlatform === "custom" ? "bg-[#2F80FF] text-white" : "text-[#9FB0C5] hover:text-white"
            }`}
          >
            قناة كتالوج مخصصة
          </button>
        </div>

        {/* Grid of Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-right">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#9FB0C5]">عنوان خادم الـ API الرئيسي (Base URL)</label>
            <input 
              type="text" 
              value={formBaseUrl}
              onChange={(e) => setFormBaseUrl(e.target.value)}
              className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]"
              placeholder="https://api.safka-eg.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#9FB0C5]">مسار جلب المنتجات (Products Endpoint)</label>
            <input 
              type="text" 
              value={formEndpoint}
              onChange={(e) => setFormEndpoint(e.target.value)}
              className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]"
              placeholder="/api/v1/public/products"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#9FB0C5]">اسم ترويسة الترخيص (API Key Header)</label>
            <input 
              type="text" 
              value={formApiKeyHeader}
              onChange={(e) => setFormApiKeyHeader(e.target.value)}
              className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#2F80FF]"
              placeholder="api-safka-key"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#9FB0C5]">مفتاح الـ API الخاص بك (Private API Key)</label>
            <div className="relative">
              <input 
                type="password" 
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl pr-4 pl-10 text-xs font-mono text-white outline-none focus:border-[#2F80FF] text-right"
                placeholder="••••••••••••••••••••••••••••••••"
              />
              <Lock className="w-4 h-4 text-[#9FB0C5] absolute left-3.5 top-3.5" />
            </div>
          </div>

        </div>

        {/* Actions Button */}
        <div className="flex gap-4 pt-2 justify-end">
          <button
            type="button"
            onClick={onTestConnection}
            disabled={testing}
            className="px-5 h-11 bg-[#12233A] hover:bg-[#20324A] border border-[#20324A] text-xs font-bold text-[#F4F7FB] rounded-xl transition cursor-pointer flex items-center gap-2"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#9FB0C5]" />
            ) : (
              <Wifi className="w-4 h-4 text-[#2F80FF]" />
            )}
            <span>اختبار صحة الاتصال (Test API)</span>
          </button>

          <button
            type="button"
            onClick={onSaveConnection}
            className="px-6 h-11 bg-[#2F80FF] hover:bg-[#4A92FF] text-xs font-black text-white rounded-xl transition cursor-pointer shadow-lg shadow-[#2F80FF]/15 flex items-center gap-2"
          >
            <ShieldCheck className="w-4.5 h-4.5" />
            <span>حفظ ومصادقة إعدادات الربط</span>
          </button>
        </div>

      </div>

    </div>
  );
}
