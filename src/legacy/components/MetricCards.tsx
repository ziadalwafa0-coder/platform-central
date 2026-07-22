import React from "react";
import { 
  Layers, 
  TrendingDown, 
  Flame, 
  Zap, 
  RefreshCw, 
  AlertCircle, 
  CircleCheck,
  TrendingUp
} from "lucide-react";
import { AnalyticsNavigationIntent } from "../types";
import { getCairoTodayStr } from "../shared/time";

interface MetricCardsProps {
  overviewData: {
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
  } | null;
  loading: boolean;
  setActiveTab: (tab: any) => void;
  setSelectedStatus: (status: string) => void;
  setNavigationIntent: (intent: AnalyticsNavigationIntent) => void;
}

export default function MetricCards({
  overviewData,
  loading,
  setActiveTab,
  setSelectedStatus,
  setNavigationIntent
}: MetricCardsProps) {
  
  const metrics = overviewData || {
    monitoredProducts: 0,
    withdrawnPiecesLastCompletedHour: 0,
    withdrawnPiecesToday: 0,
    acceleratedProducts: 0,
    withdrawalEventsToday: 0,
    affectedProductsToday: 0,
    dataCompletenessPercentage: 100,
    apiHealthPercentage: 100,
    activeCairoDate: undefined,
    lastCompletedCairoDate: undefined,
    lastCompletedCairoHour: undefined
  };

  const cards = [
    {
      id: "total",
      label: "المنتجات المراقبة",
      value: loading && !overviewData ? "..." : metrics.monitoredProducts,
      sub: "موزعة بالرادار",
      icon: Layers,
      color: "text-[#2F80FF]",
      border: "hover:border-[#2F80FF]/50",
      bg: "bg-[#2F80FF]/5",
      onClick: () => {
        setSelectedStatus("all");
        setActiveTab("products");
      }
    },
    {
      id: "last_hour_drop",
      label: "القطع المسحوبة آخر ساعة مكتملة",
      value: loading && !overviewData ? "..." : metrics.withdrawnPiecesLastCompletedHour,
      sub: "قطعة سُحبت الآن",
      icon: TrendingDown,
      color: "text-[#24C78E]",
      border: "hover:border-[#24C78E]/50",
      bg: "bg-[#24C78E]/5",
      onClick: () => {
        if (metrics.lastCompletedCairoDate !== undefined && metrics.lastCompletedCairoHour !== undefined) {
          setNavigationIntent({
            type: "last-completed-hour",
            date: metrics.lastCompletedCairoDate,
            hour: metrics.lastCompletedCairoHour
          });
        }
        setActiveTab("hourly_analytics");
      }
    },
    {
      id: "daily_drop",
      label: "القطع المسحوبة اليوم",
      value: loading && !overviewData ? "..." : metrics.withdrawnPiecesToday,
      sub: "حركة سحب تراكمية",
      icon: Flame,
      color: "text-[#24C78E]",
      border: "hover:border-[#24C78E]/50",
      bg: "bg-[#24C78E]/5",
      onClick: () => {
        const todayDate = metrics.activeCairoDate || getCairoTodayStr();
        setNavigationIntent({
          type: "today",
          date: todayDate,
          metric: "pieces"
        });
        setActiveTab("hourly_analytics");
      }
    },
    {
      id: "accelerating",
      label: "المنتجات المتسارعة",
      value: loading && !overviewData ? "..." : metrics.acceleratedProducts,
      sub: "مؤشر طلب متسارع",
      icon: TrendingUp,
      color: "text-[#24C78E]",
      border: "hover:border-[#24C78E]/50",
      bg: "bg-[#24C78E]/5",
      onClick: () => {
        setSelectedStatus("QUANTITY_DECREASE");
        setActiveTab("products");
      }
    },
    {
      id: "restocked",
      label: "عمليات السحب اليوم",
      value: loading && !overviewData ? "..." : metrics.withdrawalEventsToday,
      sub: "عمليات رصد السحب",
      icon: Zap,
      color: "text-[#FBBF24]",
      border: "hover:border-[#FBBF24]/50",
      bg: "bg-[#FBBF24]/5",
      onClick: () => {
        const todayDate = metrics.activeCairoDate || getCairoTodayStr();
        setNavigationIntent({
          type: "today",
          date: todayDate,
          metric: "events"
        });
        setActiveTab("hourly_analytics");
      }
    },
    {
      id: "low_stock",
      label: "المنتجات المتأثرة اليوم",
      value: loading && !overviewData ? "..." : metrics.affectedProductsToday,
      sub: "منتج سُحب منه اليوم",
      icon: AlertCircle,
      color: "text-[#F5A524]",
      border: "hover:border-[#F5A524]/50",
      bg: "bg-[#F5A524]/5",
      onClick: () => {
        const todayDate = metrics.activeCairoDate || getCairoTodayStr();
        setNavigationIntent({
          type: "today",
          date: todayDate,
          metric: "products"
        });
        setActiveTab("hourly_analytics");
      }
    },
    {
      id: "out_of_stock",
      label: "اكتمال البيانات",
      value: loading && !overviewData ? "..." : `${metrics.dataCompletenessPercentage}%`,
      sub: "رصد فترات ١٠ دقائق اليوم",
      icon: RefreshCw,
      color: "text-[#FBBF24]",
      border: "hover:border-[#FBBF24]/50",
      bg: "bg-[#FBBF24]/5",
      onClick: () => {
        setActiveTab("hourly_analytics");
      }
    },
    {
      id: "success_rate",
      label: "صحة الاتصال",
      value: loading && !overviewData ? "..." : `${metrics.apiHealthPercentage}%`,
      sub: "اتصال مستقر بالمنصة",
      icon: CircleCheck,
      color: "text-[#24C78E]",
      border: "hover:border-[#24C78E]/50",
      bg: "bg-[#24C78E]/5",
      onClick: () => {
        setActiveTab("history");
      }
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            onClick={card.onClick}
            className={`bg-[#0D1B2D] border border-[#20324A] p-4.5 rounded-[18px] transition-all duration-200 cursor-pointer text-right group ${card.border}`}
          >
            <div className="flex justify-between items-start gap-2">
              <span className="text-[11px] text-[#9FB0C5] font-bold line-clamp-1 leading-normal">{card.label}</span>
              <div className={`p-1.5 rounded-lg shrink-0 ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xl md:text-2xl font-black text-[#F4F7FB] font-mono leading-none tracking-tight">
                {card.value}
              </div>
              <div className="text-[9px] text-[#9FB0C5]/70 font-medium mt-1 leading-none">
                {card.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
