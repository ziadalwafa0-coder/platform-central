// @ts-nocheck
import React from "react";
import { getNextScheduledSyncCountdown } from "../shared/time";
import { 
  Grid, 
  Layers, 
  TrendingDown, 
  TrendingUp, 
  Folder, 
  RefreshCw, 
  ArrowRightLeft, 
  Bell, 
  Wifi, 
  History, 
  Settings,
  ChevronRight,
  ChevronLeft,
  Activity,
  Radio,
  Clock,
  LogOut,
  ScanSearch,
  ShieldCheck
} from "lucide-react";
import { OverviewMetrics, PlatformConnection, Product } from "../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  metrics: OverviewMetrics | null;
  products: Product[];
  connections: PlatformConnection[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogout?: () => void;
  schedulerInterval?: number;
  cairoTime?: Date;
  schedulerEnabled?: boolean;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  metrics,
  products,
  connections,
  sidebarOpen,
  setSidebarOpen,
  onLogout,
  schedulerInterval = 20,
  cairoTime = new Date(),
  schedulerEnabled = true
}: SidebarProps) {
  const activeConn = connections.find(c => c.isActive && c.monitoring_enabled);
  const { countdownStr, targetCairoTimeStr } = getNextScheduledSyncCountdown(
    cairoTime,
    schedulerEnabled,
    schedulerInterval,
    activeConn?.next_scheduled_sync_at
  );

  const menuItems = [
    { id: "home", label: "نظرة عامة", icon: Grid, badge: null },
    { id: "hourly_analytics", label: "تحليل الساعات", icon: Clock, badge: "جديد", badgeColor: "bg-[#6366f1]/15 text-[#6366f1]" },
    { id: "products", label: "المنتجات", icon: Layers, badge: products.length },
    { id: "ads_spy", label: "رادار الإعلانات", icon: ScanSearch, badge: "جديد", badgeColor: "bg-[#8B5CF6]/15 text-[#A78BFA]" },
    { id: "delivery_returns_audit", label: "تدقيق المرتجعات والتسليم", icon: ShieldCheck, badge: "جديد", badgeColor: "bg-[#24C78E]/15 text-[#24C78E]" },
    { id: "highest_decrease", label: "الأكثر سحباً", icon: TrendingDown, badge: null },
    { id: "trending", label: "المنتجات المتسارعة", icon: TrendingUp, badge: "جديد", badgeColor: "bg-[#24C78E]/15 text-[#24C78E]" },
    { id: "categories", label: "التصنيفات", icon: Folder, badge: null },
    { id: "restock", label: "إعادة التخزين", icon: RefreshCw, badge: null },
    { id: "compare", label: "مقارنة المنصات", icon: ArrowRightLeft, badge: null },
    { id: "alerts", label: "التنبيهات والتحذيرات", icon: Bell, badge: metrics?.lowStockProducts ? String(metrics.lowStockProducts) : null, badgeColor: "bg-[#F05252]/15 text-[#F05252]" },
    { id: "connect", label: "المنصات المتصلة", icon: Wifi, badge: null },
    { id: "history", label: "سجل المزامنة", icon: History, badge: null },
    { id: "settings", label: "إعدادات الرادار", icon: Settings, badge: null },
  ];

  const safkaConn = connections.find(c => c.platform === "safka");

  const getStatusText = (conn: PlatformConnection | undefined) => {
    if (!conn) return { text: "غير متصل", color: "text-[#F05252]", bg: "bg-[#F05252]/10" };
    if (!conn.isActive) return { text: "معطل", color: "text-gray-400", bg: "bg-gray-400/10" };
    if (conn.lastConnectionStatus === "SUCCESS" || conn.isActive) {
      return { text: "متصل وحي", color: "text-[#24C78E]", bg: "bg-[#24C78E]/10" };
    }
    return { text: "يحتاج مراجعة", color: "text-[#F5A524]", bg: "bg-[#F5A524]/10" };
  };

  const safkaStatus = getStatusText(safkaConn);

  return (
    <aside 
      className={`fixed top-0 bottom-0 right-0 z-30 flex flex-col bg-[#0f0f24] border-l border-[#2a2a5c] transition-all duration-300 ${
        sidebarOpen ? "w-64" : "w-20"
      }`}
    >
      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-5 border-b border-[#2a2a5c] shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#6366f1]/15 shrink-0">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          {sidebarOpen && (
            <div className="text-right leading-tight transition-all duration-300">
              <span className="text-sm font-extrabold text-[#f5f5fa] block tracking-wide font-display">ستوك رادار</span>
              <span className="text-[10px] text-[#a5a5c8] block font-mono">STOCK RADAAR</span>
            </div>
          )}
        </div>
        
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg bg-[#1c1c47] hover:bg-[#2a2a5c] text-[#a5a5c8] hover:text-[#f5f5fa] transition shrink-0 cursor-pointer"
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Workspace indicator */}
      {sidebarOpen && (
        <div className="px-5 py-3 border-b border-[#2a2a5c]/40 bg-[#0a0a1a]/50 shrink-0 text-right">
          <span className="text-[10px] text-[#a5a5c8]/70 block">الحساب النشط</span>
          <span className="text-xs font-semibold text-[#f5f5fa] block mt-0.5">صفقة للدروبشيبينغ مصر 🇪🇬</span>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-none">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-right text-xs font-bold transition-all duration-200 cursor-pointer group relative ${
                isActive 
                  ? "bg-[#1c1c47] text-[#f5f5fa] border-r-4 border-[#6366f1]" 
                  : "text-[#a5a5c8] hover:bg-[#141432] hover:text-[#f5f5fa]"
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? "text-[#6366f1]" : "text-[#a5a5c8] group-hover:text-[#f5f5fa]"}`} />
              
              {sidebarOpen ? (
                <span className="flex-1 text-right">{item.label}</span>
              ) : null}

              {item.badge !== null && sidebarOpen ? (
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                  item.badgeColor || "bg-[#6366f1]/15 text-[#6366f1]"
                }`}>
                  {item.badge}
                </span>
              ) : null}

              {/* Collapsed dot indicators */}
              {!sidebarOpen && item.badge !== null && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#F05252]" />
              )}
            </button>
          );
        })}
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-right text-xs font-bold transition-all duration-200 cursor-pointer group text-red-400 hover:bg-red-500/10 mt-2 border-t border-[#2a2a5c]/30 pt-3"
            title={!sidebarOpen ? "تسجيل الخروج" : undefined}
          >
            <LogOut className="w-4.5 h-4.5 shrink-0 text-red-400" />
            {sidebarOpen && <span className="flex-1 text-right">تسجيل الخروج</span>}
          </button>
        )}
      </nav>

      {/* Status Footer section */}
      <div className="p-4 border-t border-[#2a2a5c] bg-[#0a0a1a]/30 space-y-3 shrink-0 text-right">
        {sidebarOpen ? (
          <>
            <div className="space-y-2">
              <span className="text-[10px] text-[#a5a5c8] font-bold block">القنوات المرتبطة بالرادار</span>
              
              <div className="flex items-center justify-between bg-[#141432]/80 px-2.5 py-1.5 rounded-lg border border-[#2a2a5c]/60">
                <span className="text-xs text-[#f5f5fa] font-medium">منصة صفقة</span>
                <span className={`text-[9px] px-2 py-0.5 rounded font-black ${safkaStatus.bg} ${safkaStatus.color}`}>
                  {safkaStatus.text}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#2a2a5c]/40 text-[9px] text-[#a5a5c8]/80 space-y-1 leading-relaxed font-mono">
              <div className="flex items-center justify-between">
                <span>المزامنة القادمة:</span>
                <span className="text-[#24C78E] font-black text-[10px]">
                  {schedulerEnabled ? `${countdownStr} (${targetCairoTimeStr})` : "معطلة"}
                </span>
              </div>
              <div className="text-[8px] text-[#a5a5c8]/60">
                {schedulerInterval === 1 
                  ? "تحديث فوري (دقيقة بدقيقة)" 
                  : `دورية كل ${schedulerInterval} دقيقة (${Math.round(60 / schedulerInterval)} مرات/ساعة)`}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#24C78E]" title="صفقة متصلة" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#24C78E]/60 animate-pulse" title="الرادار يعمل" />
          </div>
        )}
      </div>
    </aside>
  );
}
