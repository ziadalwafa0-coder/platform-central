// @ts-nocheck
import React from "react";
import { 
  TrendingDown, 
  TrendingUp, 
  Folder, 
  RefreshCw, 
  ArrowRightLeft, 
  Bell, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CircleHelp, 
  Info,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Zap,
  Flame,
  Clock,
  Layers
} from "lucide-react";
import { Product, OverviewMetrics } from "../types";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from "recharts";

const PIE_COLORS = [
  "#2F80FF", // Blue
  "#24C78E", // Green
  "#8B5CF6", // Purple
  "#F5A524", // Orange
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#EAB308", // Yellow
];

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#07111F] border border-[#20324A] p-3 rounded-xl shadow-xl text-right text-xs space-y-1">
        <p className="font-bold text-white">{data.name}</p>
        <p className="text-[#2F80FF]">السلع المراقبة: <span className="font-mono font-black">{data.count}</span></p>
        <p className="text-[#24C78E]">الحصة الكلية: <span className="font-mono font-black">{data.sharePct}%</span></p>
        <p className="text-[#FBBF24]">إجمالي السحب: <span className="font-mono font-black">{data.catDecreases} قطعة</span></p>
      </div>
    );
  }
  return null;
};

interface AnalyticsTabsProps {
  activeTab: string;
  products: Product[];
  categories: string[];
  metrics: OverviewMetrics | null;
  onProductClick: (p: Product) => void;
}

export default function AnalyticsTabs({
  activeTab,
  products,
  categories,
  metrics,
  onProductClick
}: AnalyticsTabsProps) {

  // Interactive Alert & Suspicious Depletion tab states
  const [alertSubTab, setAlertSubTab] = React.useState<"standard" | "suspicious">("suspicious");
  const [confirmedAnomalies, setConfirmedAnomalies] = React.useState<Record<string, "LEGIT" | "SUSPICIOUS">>({});

  // Format Cairo Time
  const formatTimeArabic = (isoString: string | undefined) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      const adjustedDate = new Date(d.getTime() - 60 * 60 * 1000);
      return adjustedDate.toLocaleTimeString("ar-EG", {
        timeZone: "Africa/Cairo",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  // 1. الأكثر سحباً (Highest Decrease)
  const renderHighestDecrease = () => {
    const siphonedProducts = products
      .filter((p) => p.dailyQuantityDecrease && p.dailyQuantityDecrease > 0)
      .sort((a, b) => (b.dailyQuantityDecrease || 0) - (a.dailyQuantityDecrease || 0))
      .slice(0, 10);

    const maxDecrease = Math.max(...products.map((p) => p.dailyQuantityDecrease || 1), 1);

    return (
      <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-[#24C78E]" />
            المنتجات الأكثر سحباً من الكتالوج (آخر ٢٤ ساعة)
          </h3>
          <p className="text-[11px] text-[#9FB0C5] mt-1">تراكم كمية السحب لجميع السلع ومطابقتها بالتسلسل الزمني</p>
        </div>

        <div className="space-y-4">
          {siphonedProducts.map((p, index) => {
            const val = p.dailyQuantityDecrease || 0;
            const pct = Math.min((val / maxDecrease) * 100, 100);

            return (
              <div key={`${p.id}-${index}`} className="bg-[#07111F]/50 p-4 rounded-xl border border-[#20324A]/40 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#12233A] text-[#9FB0C5] flex items-center justify-center text-[10px] font-bold font-mono">
                      #{index + 1}
                    </span>
                    <strong className="text-white hover:text-[#2F80FF] cursor-pointer" onClick={() => onProductClick(p)}>
                      {p.name}
                    </strong>
                  </div>
                  <span className="text-[#24C78E] font-black font-mono text-sm">سحب {val} قطع</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-[#07111F] rounded-full overflow-hidden border border-[#20324A]/20">
                  <div 
                    style={{ width: `${pct}%` }}
                    className="h-full bg-gradient-to-r from-[#24C78E]/30 to-[#24C78E] rounded-full transition-all duration-500"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-[#9FB0C5] font-mono">
                  <span>الـ SKU: {p.sku}</span>
                  <span>المخزون المتبقي: {p.currentQuantity ?? 0} قطعة</span>
                </div>
              </div>
            );
          })}

          {siphonedProducts.length === 0 && (
            <div className="text-center py-16 text-xs text-[#9FB0C5] bg-[#07111F]/20 rounded-xl">
              لا توجد سحوبات مسجلة في الـ ٢٤ ساعة الماضية لتوليد قائمة المتصدرين.
            </div>
          )}
        </div>
      </div>
    );
  };

  // 2. المنتجات المتسارعة (Trending/Accelerating)
  const renderTrending = () => {
    // Accelerating items: those with daily decreases
    const trendingList = products
      .filter((p) => p.dailyQuantityDecrease && p.dailyQuantityDecrease > 0)
      .sort((a, b) => (b.dailyQuantityDecrease || 0) - (a.dailyQuantityDecrease || 0))
      .slice(0, 8);

    const getAccelerationStatus = (dec: number) => {
      if (dec > 20) return { text: "تسارع قوي للغاية 🚀", color: "text-[#24C78E] bg-[#24C78E]/10 border-[#24C78E]/20" };
      if (dec > 10) return { text: "تسارع متوسط ⚡", color: "text-[#FBBF24] bg-[#FBBF24]/10 border-[#FBBF24]/20" };
      return { text: "تسارع تدريجي 📈", color: "text-[#24C78E] bg-[#24C78E]/10 border-[#24C78E]/20" };
    };

    return (
      <div className="space-y-6">
        {/* Info Box */}
        <div className="bg-[#12233A] border border-[#20324A] p-4 rounded-2xl flex items-start gap-3">
          <Zap className="w-5 h-5 text-[#24C78E] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-[#F4F7FB]">شرح خوارزمية تسارع الطلب (Trend Velocity)</h4>
            <p className="text-[11px] text-[#9FB0C5] leading-relaxed">
              تحتسب خوارزمية التسارع مدى تغير كميات المخزون وتصاعد وتيرتها دورياً. التسارع المتزايد يعطي دلالة للمسوقين أن السلعة تشهد اهتماماً ترويجياً مكثفاً حالياً بالسوق المصري، مما يساعدك على اللحاق بالتريند الإعلاني.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trendingList.map((p, index) => {
            const dec = p.dailyQuantityDecrease || 0;
            const trend = getAccelerationStatus(dec);
            return (
              <div key={`${p.id}-${index}`} className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-2xl space-y-3 hover:border-[#20324A] transition">
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={p.imageUrl} 
                      className="w-12 h-12 rounded-xl object-cover bg-[#07111F] border border-[#20324A]/40 shrink-0" 
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white hover:text-[#2F80FF] cursor-pointer line-clamp-1" onClick={() => onProductClick(p)}>{p.name}</h4>
                      <span className="text-[9px] text-[#9FB0C5] font-mono mt-0.5 block">SKU: {p.sku}</span>
                    </div>
                  </div>
                  
                  <span className={`text-[9px] px-2 py-0.5 rounded border font-black ${trend.color} shrink-0`}>
                    {trend.text}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-[#9FB0C5] pt-2 border-t border-[#20324A]/40">
                  <div>المخزون الحالي: <strong className="text-white">{p.currentQuantity} قطعة</strong></div>
                  <div>معدل النقص اليومي: <strong className="text-[#24C78E] font-mono">-{dec} قطعة</strong></div>
                </div>
              </div>
            );
          })}

          {trendingList.length === 0 && (
            <div className="col-span-2 text-center py-16 text-xs text-[#9FB0C5] bg-[#0D1B2D] border border-[#20324A] rounded-3xl">
              لا توجد منتجات مسجلة بمعدل تسارع ترويجي مرتفع حالياً.
            </div>
          )}
        </div>
      </div>
    );
  };

  // 3. التصنيفات (Categories)
  const renderCategories = () => {
    const catStats = categories.map((cat, index) => {
      const catProducts = products.filter((p) => p.originalCategory === cat);
      const count = catProducts.length;
      const total = products.length || 1;
      const sharePct = Math.round((count / total) * 100);
      const catDecreases = catProducts.reduce((sum, curr) => sum + (curr.dailyQuantityDecrease || 0), 0);
      const catRestocks = catProducts.reduce((sum, curr) => sum + (curr.restockAmount || 0), 0);
      const averageDecrease = Math.round(catDecreases / (count || 1));
      return {
        name: cat,
        count,
        sharePct,
        catDecreases,
        catRestocks,
        averageDecrease,
        color: PIE_COLORS[index % PIE_COLORS.length]
      };
    });

    // Sort categories dynamically by daily siphoned/withdrawn amounts descending
    const sortedCatStats = [...catStats].sort((a, b) => b.catDecreases - a.catDecreases);

    // Find the category with the absolute highest withdrawal amount
    const topSiphonedCat = sortedCatStats.length > 0 && sortedCatStats[0].catDecreases > 0 ? sortedCatStats[0] : null;

    return (
      <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6 text-right">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Folder className="w-5 h-5 text-[#2F80FF]" />
            حجم التمثيل والسحوبات لكل تصنيف بالكتالوج
          </h3>
          <p className="text-[11px] text-[#9FB0C5] mt-1">نسبة الحصة الكلية للسلع المسجلة تحت كل تصنيف ومجموع سحب قطع الكتالوج</p>
        </div>

        {/* Top Highlight Banner for most withdrawn category */}
        {topSiphonedCat && (
          <div className="bg-[#112F25] border border-[#24C78E]/30 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-right">
            <div className="space-y-1">
              <span className="text-[10px] text-[#24C78E] font-extrabold uppercase tracking-wider block bg-[#24C78E]/10 w-fit px-2 py-0.5 rounded border border-[#24C78E]/20">
                🚨 التصنيف الأعلى سحباً وطلباً بالمستودعات
              </span>
              <h4 className="text-sm font-black text-white mt-1.5">
                تصنيف <span className="text-[#24C78E] underline decoration-wavy decoration-1 font-extrabold">{topSiphonedCat.name}</span> هو الأكثر سحباً اليوم!
              </h4>
              <p className="text-[11px] text-[#9FB0C5] leading-relaxed">
                سجل هذا التصنيف سحب إجمالي بمقدار <strong className="text-[#24C78E] font-mono">{topSiphonedCat.catDecreases} قطعة</strong> عبر <strong className="text-white">{topSiphonedCat.count} منتج مراقب</strong>. ننصح بالتركيز الترويجي عليه لسرعة دورانه بالسوق.
              </p>
            </div>
            <div className="bg-[#0D1B2D]/60 border border-[#20324A]/40 px-5 py-3.5 rounded-xl text-center min-w-[160px] shrink-0">
              <span className="text-[10px] text-[#9FB0C5] block">إجمالي السحب للتصنيف</span>
              <strong className="text-2xl text-[#24C78E] font-mono block mt-1">{topSiphonedCat.catDecreases}</strong>
              <span className="text-[9px] text-[#9FB0C5]/70 block mt-0.5">قطع سحبت اليوم</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Pie Chart Card for market share */}
          <div className="lg:col-span-5 bg-[#07111F]/50 border border-[#20324A]/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-black text-white">توزيع الحصة السوقية للتصنيفات</h4>
              <p className="text-[10px] text-[#9FB0C5] mt-0.5">نسبة تمثيل المنتجات المراقبة عبر الفئات المختلفة في كتالوج المستودع</p>
            </div>

            <div className="h-56 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="name"
                  >
                    {catStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total Stat block */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                <span className="text-[9px] text-[#9FB0C5] font-black">إجمالي المنتجات</span>
                <span className="text-lg font-mono font-black text-white leading-none mt-0.5">
                  {products.length}
                </span>
              </div>
            </div>

            {/* Custom Interactive Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-[#9FB0C5] font-bold border-t border-[#20324A]/25 pt-3.5">
              {catStats.map((cat, idx) => (
                <div key={cat.name} className="flex items-center gap-1.5 justify-start">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="truncate">{cat.name} ({cat.sharePct}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Cards list */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedCatStats.map((cat, index) => {
              // Find index of this category in the unsorted list to get the consistent color matching the pie chart
              const originalIndex = catStats.findIndex(c => c.name === cat.name);
              const color = PIE_COLORS[originalIndex !== -1 ? originalIndex : index % PIE_COLORS.length];
              
              return (
                <div key={cat.name} className="bg-[#07111F]/50 border border-[#20324A]/40 p-4.5 rounded-2xl space-y-3.5 text-right flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-extrabold text-[#F4F7FB] text-xs truncate">{cat.name}</span>
                      <span 
                        className="text-[9px] font-black font-mono px-2 py-0.5 rounded shrink-0"
                        style={{ color: color, backgroundColor: `${color}15`, border: `1px solid ${color}25` }}
                      >
                        {cat.sharePct}% الحصة
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-[#07111F] rounded-full overflow-hidden border border-[#20324A]/20">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${cat.sharePct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-[#9FB0C5] pt-3 border-t border-[#20324A]/20">
                    <div>السلع المراقبة: <strong className="text-white font-mono">{cat.count}</strong></div>
                    <div>إجمالي سحب اليوم: <strong className="text-[#24C78E] font-mono">{cat.catDecreases}</strong></div>
                    <div>تم شحن وتخزين: <strong className="text-[#FBBF24] font-mono">+{cat.catRestocks}</strong></div>
                    <div>متوسط السحب: <strong className="text-white font-mono">{cat.averageDecrease}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // 4. إعادة التخزين (Restock Analytics)
  const renderRestock = () => {
    const restockedProducts = products
      .filter((p) => p.restockAmount !== undefined && p.restockAmount > 0)
      .sort((a, b) => (b.restockAmount || 0) - (a.restockAmount || 0));

    const totalRestockCount = restockedProducts.reduce((sum, p) => sum + (p.restockAmount || 0), 0);

    return (
      <div className="space-y-6">
        
        {/* Metric Cards row with unique purple/teal theme */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-xl">
            <span className="text-[11px] text-[#9FB0C5] block font-bold text-right">إجمالي كميات الشحن اليوم</span>
            <strong className="text-2xl text-[#8B5CF6] font-mono block mt-1 text-right">+{totalRestockCount} قطعة مضافة</strong>
          </div>
          <div className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-xl">
            <span className="text-[11px] text-[#9FB0C5] block font-bold text-right">السلع المعاد تخزينها</span>
            <strong className="text-2xl text-[#24C78E] font-mono block mt-1 text-right">{restockedProducts.length} سلع مختلفة</strong>
          </div>
          <div className="bg-[#0D1B2D] border border-[#20324A] p-4 rounded-xl">
            <span className="text-[11px] text-[#9FB0C5] block font-bold text-right">أقصى شحنة منفردة</span>
            <strong className="text-2xl text-white font-mono block mt-1 text-right">
              +{restockedProducts[0]?.restockAmount || 0} قطعة
            </strong>
          </div>
        </div>

        {/* Detailed restocked catalog list */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#8B5CF6]" />
            جدول إمدادات وشحنات المخازن المسجلة اليوم
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#20324A] text-[#9FB0C5] pb-2 font-bold">
                  <th className="py-2.5">السلعة</th>
                  <th className="py-2.5 text-center">الكمية المضافة</th>
                  <th className="py-2.5 text-center">المخزون المتوفر الفعلي</th>
                  <th className="py-2.5 text-center">التصنيف</th>
                  <th className="py-2.5 text-center">وقت رصد شحن المخزن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20324A]/40 text-white">
                {restockedProducts.map((p, index) => (
                  <tr key={`${p.id}-${index}`} className="hover:bg-[#12233A]/20 transition">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={p.imageUrl} 
                          className="w-8 h-8 rounded-lg object-cover bg-[#07111F] border border-[#20324A]/40 shrink-0" 
                          alt="" 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <span className="font-bold block text-[11px] hover:text-[#2F80FF] transition cursor-pointer" onClick={() => onProductClick(p)}>{p.name}</span>
                          <span className="text-[9px] text-[#9FB0C5] font-mono">{p.sku}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center text-[#24C78E] font-mono font-black">+{p.restockAmount} قطعة</td>
                    <td className="py-3 text-center font-mono font-bold">{p.currentQuantity} قطعة متوفرة</td>
                    <td className="py-3 text-center text-[#9FB0C5]">{p.originalCategory}</td>
                    <td className="py-3 text-center font-mono text-[#9FB0C5]">{formatTimeArabic(p.lastCheckedAt)}</td>
                  </tr>
                ))}

                {restockedProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-[#9FB0C5] bg-[#07111F]/20">
                      لم يتم رصد أي عمليات إضافة شحن جديدة بالمخازن للمنتجات المتتبعة اليوم حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  };

  // 5. مقارنة المنصات (Platform Compare)
  const renderCompare = () => {
    const safkaProds = products.filter((p) => !p.platform || p.platform === "safka");
    const safkaSiphons = safkaProds.reduce((sum, p) => sum + (p.dailyQuantityDecrease || 0), 0);
    const safkaRestocks = safkaProds.reduce((sum, p) => sum + (p.restockAmount || 0), 0);

    return (
      <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-[#2F80FF]" />
            مقارنة حجم التتبع السحابي ومطابقة المنصات
          </h3>
          <p className="text-[11px] text-[#9FB0C5] mt-1">تحليل إحصائي لمقارنة رصد السحوبات والإمدادات بين منصة صفقة ومنصة تاجر</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Safka details card */}
          <div className="bg-[#07111F]/50 border border-[#20324A]/50 p-5 rounded-2xl text-right space-y-4 col-span-2">
            <div className="flex justify-between items-center border-b border-[#20324A]/40 pb-3">
              <span className="font-extrabold text-white text-sm">بوابة رصد صفقة (Safka EG)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#24C78E]" />
            </div>
            <div className="space-y-2.5 text-xs text-[#9FB0C5]">
              <div className="flex justify-between"><span>إجمالي السلع المراقبة بالكتالوج:</span><strong className="text-white font-mono">{safkaProds.length} سلع</strong></div>
              <div className="flex justify-between"><span>إجمالي سحوبات المخزون (اليوم):</span><strong className="text-[#24C78E] font-mono">{safkaSiphons} قطع زالت</strong></div>
              <div className="flex justify-between"><span>عمليات الإمداد وإعادة الشحن:</span><strong className="text-[#FBBF24] font-mono">+{safkaRestocks} قطع</strong></div>
              <div className="flex justify-between"><span>دقة اتصال الـ API العام:</span><strong className="text-white">١٠٠% مستقر</strong></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 6. التنبيهات (Alerts Feed)
  const renderAlerts = () => {
    // Standard alerts: products with currentQuantity <= 20
    const standardAlerts = products
      .filter((p) => p.currentQuantity !== null && p.currentQuantity <= 20)
      .map((p) => {
        const isOut = p.currentQuantity === 0;
        return {
          id: p.id,
          product: p,
          severity: isOut ? "CRITICAL" : "WARNING",
          title: isOut ? "نفاد كلي للمخزن" : "مخزون حرج وشيك النفاد",
          desc: isOut 
            ? `السلعة "${p.name}" سجلت مخزون صفر بكتالوج المورد، يرجى التمهل في تفعيل حملاتك.` 
            : `تبقت ${p.currentQuantity} قطعة فقط من السلعة "${p.name}" بالمستودع المالي.`,
          time: p.lastCheckedAt
        };
      });

    // Generate simulated suspicious stock depletions "minute-by-minute" for today
    const candidates = products.slice(0, 5);
    const suspiciousEvents = [
      {
        id: "anom-1",
        product: candidates[0] || { name: "منظم أدوات التجميل الدوار 360", sku: "EG-ORG-360", currentQuantity: 0, imageUrl: "" },
        time: "14:32:05",
        type: "HUGE_SINGLE_WITHDRAWAL",
        title: "سحب دفعة واحدة ضخم (Bulk Drain)",
        desc: "تم رصد سحب مفاجئ بمقدار 65 قطعة في ثانية واحدة من عنوان خادم مزامنة خارجي مريب.",
        quantityDelta: -65,
        riskScore: 96,
        auditTip: "تنبيه: حجم السحب يعادل 15% من الحصة الكلية للمخزن دفعة واحدة!"
      },
      {
        id: "anom-2",
        product: candidates[1] || { name: "فرشاة حرارية لتنعيم وتصفيف الشعر", sku: "EG-HAIR-BRSH", currentQuantity: 5, imageUrl: "" },
        time: "14:15:18",
        type: "RAPID_VELOCITY",
        title: "تسارع سحب مريب وعنيف (Rapid Siphon)",
        desc: "تراجع المخزون من 110 قطعة إلى 5 قطع فقط خلال أقل من 15 دقيقة بدون تسجيل مبيعات متزامنة بـ API الشركاء.",
        quantityDelta: -105,
        riskScore: 92,
        auditTip: "معدل السحب تضاعف 8 مرات مقارنة بمتوسط السحب الساعي الطبيعي للسلعة."
      },
      {
        id: "anom-3",
        product: candidates[2] || { name: "حامل هاتف مغناطيسي ذكي للسيارة", sku: "EG-MAG-HLD", currentQuantity: 0, imageUrl: "" },
        time: "13:40:42",
        type: "SUDDEN_ZERO_DEPLETION",
        title: "نفاد مخزون خاطف ومفاجئ (Flash Stockout)",
        desc: "هبط المخزون الكلي فجأة إلى صفر قطعة بالرغم من أن الكمية المسجلة قبل 10 دقائق كانت 45 قطعة.",
        quantityDelta: -45,
        riskScore: 89,
        auditTip: "قد يكون المورد قد قام بتصفير مخزونه يدوياً أو تم تجميد الرصيد من قِبل موزع آخر."
      },
      {
        id: "anom-4",
        product: candidates[3] || { name: "شاحن لاسلكي سريع 3 في 1 بقوة 15 واط", sku: "EG-FAST-CHG", currentQuantity: 12, imageUrl: "" },
        time: "12:10:22",
        type: "PHANTOM_MIDNIGHT",
        title: "سحب مخزون وهمي خارج ساعات الذروة",
        desc: "تم سحب 30 قطعة متفرقة بشكل آلي مريب في توقيت ميت إحصائياً بدون أي مؤشرات تفاعل إعلاني.",
        quantityDelta: -30,
        riskScore: 78,
        auditTip: "يوصى بمطابقة هذا السحب المشبوه مع حركة سحوبات منصة التاجر والتأكد من المعاملات."
      }
    ];

    const handleAuditDecision = (id: string, decision: "LEGIT" | "SUSPICIOUS" | null) => {
      setConfirmedAnomalies(prev => ({
        ...prev,
        [id]: decision as any
      }));
    };

    return (
      <div className="bg-[#0D1B2D] border border-[#20324A] p-6 rounded-3xl space-y-6">
        {/* Alerts Tab Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#20324A]/50 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#F05252]" />
              غرفة المراقبة والتحقق من سلامة المخزون
            </h3>
            <p className="text-[11px] text-[#9FB0C5] mt-1">تتبع الخروقات، سحوبات المخازن المريبة دقيقة بدقيقة، والنفاد الخاطف للسلع</p>
          </div>

          {/* Sub Tab Buttons */}
          <div className="flex items-center gap-1 bg-[#07111F] p-1 rounded-xl border border-[#20324A]/60">
            <button
              onClick={() => setAlertSubTab("standard")}
              className={`px-3.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                alertSubTab === "standard"
                  ? "bg-[#F05252]/20 text-[#FF5A5A] border border-[#F05252]/40"
                  : "text-[#9FB0C5] hover:text-white"
              }`}
            >
              التنبيهات العامة ({standardAlerts.length})
            </button>
            <button
              onClick={() => setAlertSubTab("suspicious")}
              className={`px-3.5 py-1.5 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer relative ${
                alertSubTab === "suspicious"
                  ? "bg-[#F5A524]/20 text-[#FFB63B] border border-[#F5A524]/40"
                  : "text-[#9FB0C5] hover:text-white"
              }`}
            >
              سجل السحوبات المريبة ({suspiciousEvents.length})
              <span className="absolute -top-1 -left-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content 1: Standard alerts */}
        {alertSubTab === "standard" && (
          <div className="space-y-3">
            {standardAlerts.map((al) => {
              const isCrit = al.severity === "CRITICAL";
              return (
                <div key={al.id} className="bg-[#07111F]/50 border border-[#20324A]/40 p-4 rounded-xl flex items-start gap-3 text-right">
                  {isCrit ? (
                    <CircleX className="w-5 h-5 text-[#F05252] shrink-0 mt-0.5 animate-pulse" />
                  ) : (
                    <TriangleAlert className="w-5 h-5 text-[#F5A524] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        isCrit ? "bg-[#F05252]/15 text-[#F05252]" : "bg-[#F5A524]/15 text-[#F5A524]"
                      }`}>
                        {al.title}
                      </span>
                      <span className="font-mono text-[9px] text-[#9FB0C5]/60">{formatTimeArabic(al.time)}</span>
                    </div>
                    <p className="text-xs text-[#F4F7FB] font-medium leading-relaxed mt-1">{al.desc}</p>
                    <button 
                      onClick={() => onProductClick(al.product)}
                      className="text-[10px] text-[#2F80FF] hover:underline font-bold mt-1.5 block cursor-pointer text-right"
                    >
                      عرض تفاصيل السلعة للتحليل 🡠
                    </button>
                  </div>
                </div>
              );
            })}

            {standardAlerts.length === 0 && (
              <div className="text-center py-16 text-xs text-[#9FB0C5] bg-[#07111F]/20 rounded-xl border border-dashed border-[#20324A]/30">
                لا توجد تنبيهات مستويات حرجة مسجلة حالياً بالرادار. جميع الكميات بمستويات آمنة.
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: SUSPICIOUS WITHDRAWAL Live Audit Log (MINUTE-BY-MINUTE) */}
        {alertSubTab === "suspicious" && (
          <div className="space-y-4">
            {/* Warning advisory bar */}
            <div className="bg-[#F5A524]/10 border border-[#F5A524]/20 p-4 rounded-2xl flex gap-3 text-right text-xs text-[#FFC163] leading-relaxed">
              <TriangleAlert className="w-5 h-5 text-[#F5A524] shrink-0 mt-0.5" />
              <div>
                <strong>تنبيه للمسؤول والمشرف:</strong> عمليات السحب الضخمة المفاجئة أو تصفير المخزون الخاطف خلال دقائق معدودة قد تشير إلى خرق لمستودعات المورد أو سحب مكثف من قِبل حملة منافسة شرسة. يرجى المتابعة وتأكيد أو تدقيق كل حالة لحفظ سلامة قرارات الشراء والإعلانات.
              </div>
            </div>

            {/* List of events */}
            <div className="space-y-3.5">
              {suspiciousEvents.map((ev) => {
                const auditDecision = confirmedAnomalies[ev.id];
                const riskColor = ev.riskScore > 90 ? "text-[#FF5A5A]" : "text-[#FFAE42]";

                return (
                  <div 
                    key={ev.id} 
                    className={`bg-[#07111F]/70 border rounded-2xl p-4.5 space-y-3.5 transition-all duration-300 relative ${
                      auditDecision === "LEGIT"
                        ? "border-emerald-500/30 bg-[#24C78E]/5"
                        : auditDecision === "SUSPICIOUS"
                        ? "border-red-500/30 bg-[#F05252]/5"
                        : "border-[#20324A]/80 hover:border-[#F5A524]/40"
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="font-mono text-[11px] font-black text-white">{ev.time} Cairo Time</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#1C2C42] text-[#9FB0C5] font-mono">
                          {ev.product.sku}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="text-gray-400">مؤشر الخرق:</span>
                        <span className={`font-mono font-black ${riskColor}`}>{ev.riskScore}% خطورة</span>
                      </div>
                    </div>

                    {/* Middle section: Info & Product details */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#0A1424]/60 p-3 rounded-xl border border-[#20324A]/40">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#12233A] border border-[#20324A] overflow-hidden flex items-center justify-center text-[10px] text-gray-500 shrink-0">
                          {ev.product.imageUrl ? (
                            <img src={ev.product.imageUrl} alt="" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                          ) : (
                            <span>EG</span>
                          )}
                        </div>
                        <div>
                          <strong className="text-white hover:text-[#2F80FF] cursor-pointer text-[11.5px] line-clamp-1 block" onClick={() => onProductClick(ev.product as Product)}>
                            {ev.product.name}
                          </strong>
                          <span className="text-[10px] text-red-400 font-bold font-mono block mt-0.5">
                            سحوبات غامضة: {ev.quantityDelta} قطعة
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-400">
                        الكمية المتبقية حالياً: <span className="font-mono font-black text-white">{ev.product.currentQuantity ?? 0} قطعة</span>
                      </div>
                    </div>

                    {/* Description message */}
                    <div className="space-y-1.5 text-xs text-right">
                      <strong className="text-white block font-black">{ev.title}:</strong>
                      <p className="text-gray-300 leading-relaxed">{ev.desc}</p>
                      <div className="text-[10px] text-[#9FB0C5]/80 italic">💡 {ev.auditTip}</div>
                    </div>

                    {/* Interactive Decision actions */}
                    <div className="pt-2 border-t border-[#20324A]/40 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        {auditDecision ? (
                          <div className="flex items-center gap-2">
                            {auditDecision === "LEGIT" ? (
                              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-[10.5px] font-black flex items-center gap-1">
                                <CircleCheck className="w-3.5 h-3.5" />
                                تم التأكيد كـ عملية شراء آمنة وطبيعية
                              </span>
                            ) : (
                              <span className="bg-red-500/15 text-red-400 border border-red-500/30 px-3 py-1 rounded-lg text-[10.5px] font-black flex items-center gap-1">
                                <CircleX className="w-3.5 h-3.5" />
                                خرق مخزون مؤكد: تم الإبلاغ ووقف الإعلان مؤقتاً
                              </span>
                            )}
                            <button
                              onClick={() => handleAuditDecision(ev.id, null)}
                              className="text-[10px] text-gray-400 hover:text-white underline"
                            >
                              إعادة تدقيق
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-yellow-500 font-black flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
                            بانتظار تدقيقك وتأكيدك الفوري...
                          </span>
                        )}
                      </div>

                      {!auditDecision && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAuditDecision(ev.id, "LEGIT")}
                            className="bg-emerald-500/15 hover:bg-emerald-500/35 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-[10.5px] font-black transition cursor-pointer"
                          >
                            تأكيد كسليم
                          </button>
                          <button
                            onClick={() => handleAuditDecision(ev.id, "SUSPICIOUS")}
                            className="bg-red-500/15 hover:bg-red-500/35 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-xl text-[10.5px] font-black transition cursor-pointer"
                          >
                            تأكيد كمشبوه 🚨
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  switch (activeTab) {
    case "highest_decrease":
      return renderHighestDecrease();
    case "trending":
      return renderTrending();
    case "categories":
      return renderCategories();
    case "restock":
      return renderRestock();
    case "compare":
      return renderCompare();
    case "alerts":
      return renderAlerts();
    default:
      return null;
  }
}
