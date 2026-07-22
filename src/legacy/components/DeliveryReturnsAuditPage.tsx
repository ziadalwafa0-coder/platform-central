// @ts-nocheck
import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Percent, 
  ArrowRightLeft, 
  CircleHelp, 
  Calendar, 
  TriangleAlert, 
  CheckCircle, 
  CircleX, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Info, 
  RefreshCw, 
  ArrowDownLeft, 
  ArrowUpRight,
  TrendingUp,
  FileText,
  Scale
} from "lucide-react";
import { safeFetchJson } from "../lib/api";
import { DateRangePicker } from "./DateRangePicker";

interface DeliveryReturnsAuditPageProps {
  onProductClick?: (product: any) => void;
}

export function DeliveryReturnsAuditPage({ onProductClick }: DeliveryReturnsAuditPageProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [highReturnsOnly, setHighReturnsOnly] = useState(false);

  // default to starting from 7 days ago
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [weekEnd, setWeekEnd] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  useEffect(() => {
    fetchAuditData();
  }, [weekStart, weekEnd]);

  const fetchAuditData = async () => {
    if (weekStart > weekEnd) {
      setError("تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء (يرجى اختيار نطاق تاريخ صحيح)");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await safeFetchJson(`/api/delivery-returns-audit?weekStart=${weekStart}&weekEnd=${weekEnd}`);
      if (!res.success) throw new Error(res.error || "Failed to load audit data");
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#a5a5c8] gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#6366f1]" />
        <span className="text-sm font-semibold">جاري تشغيل المدقق وإعادة حساب دورات المخزون...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center space-y-4">
        <TriangleAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">حدث خطأ أثناء تحميل مدقق البيانات</h3>
        <p className="text-xs text-red-300 max-w-md mx-auto">{error}</p>
        <button 
          onClick={fetchAuditData}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl transition"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { totals, products = [], algorithm } = data;

  // Filter products
  const filteredProducts = products.filter((p: any) => {
    // Search filter
    const matchesSearch = p.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    const matchesStatus = selectedStatus === "all" || p.dataQuality.status === selectedStatus;
    
    // Low confidence only
    const matchesLowConfidence = !lowConfidenceOnly || p.dataQuality.confidenceScore < 60;
    
    // High returns only (e.g. returnRate > 25%)
    const matchesHighReturns = !highReturnsOnly || (p.totals.returnRate !== null && p.totals.returnRate > 25);

    return matchesSearch && matchesStatus && matchesLowConfidence && matchesHighReturns;
  });

  const toggleProductExpand = (id: string) => {
    setExpandedProduct(expandedProduct === id ? null : id);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0a0a1a]/60 p-5 rounded-2xl border border-[#2a2a5c]">
        <div>
          <h2 className="text-lg font-extrabold text-[#f5f5fa] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#24C78E]" />
            مدقق تسليم واسترجاع الشحنات
          </h2>
          <p className="text-xs text-[#a5a5c8] mt-1">
            تحليل دقيق وموثوقية عالية لمطابقة دورات المخزون وتقييم جودة البيانات والحد من العشوائية.
          </p>
        </div>
        
        <DateRangePicker 
          startDate={weekStart}
          endDate={weekEnd}
          onChange={(start, end) => {
            setWeekStart(start);
            setWeekEnd(end);
          }}
        />
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Confidence Score */}
        <div className="bg-[#0a0a1a]/40 p-4 rounded-xl border border-[#2a2a5c] flex flex-col justify-between">
          <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">متوسط موثوقية البيانات</span>
          <div>
            <span className={`text-xl font-extrabold ${totals.averageConfidenceScore >= 80 ? "text-[#24C78E]" : totals.averageConfidenceScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {totals.averageConfidenceScore.toFixed(0)}%
            </span>
            <span className="text-[9px] text-[#a5a5c8] block mt-0.5">Estimated, not exact</span>
          </div>
        </div>

        {/* Delivery Rate */}
        <div className="bg-[#0a0a1a]/40 p-4 rounded-xl border border-[#2a2a5c] flex flex-col justify-between">
          <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">متوسط نسبة التسليم</span>
          <div>
            <span className="text-xl font-extrabold text-[#6366f1]">
              {totals.averageDeliveryRate !== null ? `${totals.averageDeliveryRate.toFixed(1)}%` : "-"}
            </span>
            <span className="text-[9px] text-[#a5a5c8] block mt-0.5">من الشحنات المسحوبة</span>
          </div>
        </div>

        {/* Return Rate */}
        <div className="bg-[#0a0a1a]/40 p-4 rounded-xl border border-[#2a2a5c] flex flex-col justify-between">
          <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">متوسط نسبة المرتجعات</span>
          <div>
            <span className="text-xl font-extrabold text-red-400">
              {totals.averageReturnRate !== null ? `${totals.averageReturnRate.toFixed(1)}%` : "-"}
            </span>
            <span className="text-[9px] text-[#a5a5c8] block mt-0.5">تقديرية من دورات السحب</span>
          </div>
        </div>

        {/* Total Withdrawals */}
        <div className="bg-[#0a0a1a]/40 p-4 rounded-xl border border-[#2a2a5c] flex flex-col justify-between">
          <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">إجمالي السحب (طلب شحن)</span>
          <div>
            <span className="text-xl font-extrabold text-[#f5f5fa]">
              {totals.totalWithdrawals}
            </span>
            <span className="text-[9px] text-[#a5a5c8] block mt-0.5">قطعة مسحوبة</span>
          </div>
        </div>

        {/* Estimated Returns */}
        <div className="bg-[#0a0a1a]/40 p-4 rounded-xl border border-[#2a2a5c] flex flex-col justify-between">
          <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">المرتجع التقديري</span>
          <div>
            <span className="text-xl font-extrabold text-orange-400">
              {totals.totalEstimatedReturns}
            </span>
            <span className="text-[9px] text-[#a5a5c8] block mt-0.5">قطعة تقديرية</span>
          </div>
        </div>

        {/* Confirmed Restock */}
        <div className="bg-[#0a0a1a]/40 p-4 rounded-xl border border-[#2a2a5c] flex flex-col justify-between">
          <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">إعادة شحن مؤكدة</span>
          <div>
            <span className="text-xl font-extrabold text-emerald-400">
              {totals.totalConfirmedRestock}
            </span>
            <span className="text-[9px] text-[#a5a5c8] block mt-0.5">بمصدر صريح صلب</span>
          </div>
        </div>

        {/* Unclassified Increases */}
        <div className="bg-[#0a0a1a]/40 p-4 rounded-xl border border-[#2a2a5c] flex flex-col justify-between">
          <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">زيادة غير مصنفة</span>
          <div>
            <span className="text-xl font-extrabold text-slate-400">
              {totals.totalUnclassifiedIncreases}
            </span>
            <span className="text-[9px] text-[#a5a5c8] block mt-0.5">خارج دورة السحب النشطة</span>
          </div>
        </div>
      </div>

      <div className="bg-[#0a0a1a]/60 p-5 rounded-2xl border border-[#2a2a5c] space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Scale className="w-5 h-5 text-[#6366f1]" />
          <h3 className="text-sm font-bold">لوحة مطابقة وتفسير منهجيات حساب المرتجعات والتسليم</h3>
        </div>
        <p className="text-xs text-[#a5a5c8] leading-relaxed">
          هناك طريقتان لحساب المرتجعات والتسليم بناءً على كيفية التعامل مع عمليات إعادة التخزين والتوريد المؤكدة (<span className="text-emerald-400 font-semibold">Confirmed Restock</span>):
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {/* Method 1: Report View (Per-Batch) */}
          <div className="bg-[#0f0f24] p-4 rounded-xl border border-[#2a2a5c]/40 space-y-2 text-right">
            <div className="flex justify-between items-center border-b border-[#2a2a5c]/40 pb-2">
              <span className="font-bold text-white text-xs">١. تقرير الملخص (تصفير الدفعات - Per-Batch)</span>
              <span className="text-[10px] bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-full font-bold">الافتراضي في الملخص</span>
            </div>
            <p className="text-[11px] text-[#a5a5c8] leading-relaxed">
              عند حدوث أي عملية توريد مؤكدة، يتم <strong>تصفير رصيد السحب المعلق</strong> فوراً. تفترض هذه الطريقة أن جميع المنتجات المسحوبة في الدفعة السابقة قد سُلمت بالفعل، وأن أي مرتجعات لاحقة لا يمكن أن تُنسب إليها.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
              <div className="bg-[#0a0a1a]/40 p-2 rounded">
                <span className="text-[#a5a5c8] block text-[10px]">معدل التسليم المقدر</span>
                <span className="font-bold text-[#6366f1] text-sm">
                  {totals.perBatchTotals?.averageDeliveryRate !== null ? `${totals.perBatchTotals.averageDeliveryRate.toFixed(1)}%` : "-"}
                </span>
              </div>
              <div className="bg-[#0a0a1a]/40 p-2 rounded">
                <span className="text-[#a5a5c8] block text-[10px]">معدل المرتجعات المقدر</span>
                <span className="font-bold text-red-400 text-sm">
                  {totals.perBatchTotals?.averageReturnRate !== null ? `${totals.perBatchTotals.averageReturnRate.toFixed(1)}%` : "-"}
                </span>
              </div>
              <div className="bg-[#0a0a1a]/40 p-2 rounded col-span-2 flex justify-between items-center">
                <span className="text-[#a5a5c8]">إجمالي المرتجعات المقدرة</span>
                <span className="font-bold text-white font-mono">{totals.perBatchTotals?.totalEstimatedReturns} قطعة</span>
              </div>
            </div>
          </div>

          {/* Method 2: Audit View (Cross-Restock) */}
          <div className="bg-[#0f0f24] p-4 rounded-xl border border-yellow-500/20 space-y-2 text-right">
            <div className="flex justify-between items-center border-b border-[#2a2a5c]/40 pb-2">
              <span className="font-bold text-yellow-400 text-xs">٢. المدقق التفصيلي (تطابق متقاطع - Cross-Restock)</span>
              <span className="text-[10px] bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full font-bold">المعروض في هذه الصفحة</span>
            </div>
            <p className="text-[11px] text-[#a5a5c8] leading-relaxed">
              عمليات التوريد الصريحة لا تؤثر على رصيد السحب المعلق؛ <strong>يستمر تتبع الرصيد عبر الدفعات</strong>. يضمن ذلك مطابقة المرتجعات التي تتأخر عن دفعاتها الأصلية وتصل بعد التوريد الجديد، وهو الأكثر دقة للأمان المالي والتحقيق.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
              <div className="bg-[#0a0a1a]/40 p-2 rounded">
                <span className="text-[#a5a5c8] block text-[10px]">معدل التسليم المتقاطع</span>
                <span className="font-bold text-[#6366f1] text-sm">
                  {totals.averageDeliveryRate !== null ? `${totals.averageDeliveryRate.toFixed(1)}%` : "-"}
                </span>
              </div>
              <div className="bg-[#0a0a1a]/40 p-2 rounded">
                <span className="text-[#a5a5c8] block text-[10px]">معدل المرتجعات المتقاطع</span>
                <span className="font-bold text-red-400 text-sm">
                  {totals.averageReturnRate !== null ? `${totals.averageReturnRate.toFixed(1)}%` : "-"}
                </span>
              </div>
              <div className="bg-[#0a0a1a]/40 p-2 rounded col-span-2 flex justify-between items-center">
                <span className="text-[#a5a5c8]">إجمالي المرتجعات المتقاطعة</span>
                <span className="font-bold text-white font-mono">{totals.totalEstimatedReturns} قطعة</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table Section */}
      <div className="bg-[#0a0a1a]/60 rounded-2xl border border-[#2a2a5c] p-5 space-y-4">
        {/* Filters Panel */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 right-3 flex items-center text-[#a5a5c8]">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text" 
                placeholder="ابحث باسم المنتج أو SKU..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#0f0f24] border border-[#2a2a5c] text-white text-xs rounded-xl pr-10 pl-3 py-2.5 outline-none placeholder-[#a5a5c8]/50 focus:border-[#6366f1]"
              />
            </div>

            {/* Status Select */}
            <select 
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-[#0f0f24] border border-[#2a2a5c] text-white text-xs rounded-xl px-3 py-2.5 outline-none cursor-pointer focus:border-[#6366f1]"
            >
              <option value="all">كل درجات الموثوقية</option>
              <option value="HIGH">موثوقية عالية (&gt;= 80%)</option>
              <option value="MEDIUM">موثوقية متوسطة (50% - 79%)</option>
              <option value="LOW">موثوقية منخفضة (&lt; 50%)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Checkboxes */}
            <label className="flex items-center gap-2 text-xs text-[#a5a5c8] cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={lowConfidenceOnly}
                onChange={e => setLowConfidenceOnly(e.target.checked)}
                className="rounded border-[#2a2a5c] bg-[#0f0f24] text-[#6366f1] focus:ring-0"
              />
              مشاكل جودة البيانات فقط
            </label>

            <label className="flex items-center gap-2 text-xs text-[#a5a5c8] cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={highReturnsOnly}
                onChange={e => setHighReturnsOnly(e.target.checked)}
                className="rounded border-[#2a2a5c] bg-[#0f0f24] text-[#6366f1] focus:ring-0"
              />
              مرتجع عالي (&gt; 25%)
            </label>
          </div>
        </div>

        {/* Products Audit Table */}
        <div className="overflow-x-auto rounded-xl border border-[#2a2a5c]">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-[#0f0f24] text-[#a5a5c8] border-b border-[#2a2a5c]">
                <th className="p-4 font-bold">المنتج</th>
                <th className="p-4 font-bold">SKU</th>
                <th className="p-4 font-bold text-center">درجة الموثوقية</th>
                <th className="p-4 font-bold text-center">نسبة التسليم</th>
                <th className="p-4 font-bold text-center">نسبة الاسترجاع</th>
                <th className="p-4 font-bold text-center">السحب</th>
                <th className="p-4 font-bold text-center">مرتجع تقديري</th>
                <th className="p-4 font-bold text-center">زيادة غير مصنفة</th>
                <th className="p-4 font-bold text-center">تفاصيل حية</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#a5a5c8]">
                    لا توجد منتجات مطابقة لخيارات الفرز الحالية.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p: any) => {
                  const isExpanded = expandedProduct === p.productId;
                  return (
                    <React.Fragment key={p.productId}>
                      <tr 
                        onClick={() => toggleProductExpand(p.productId)}
                        className={`border-b border-[#2a2a5c]/40 hover:bg-[#141432]/40 transition cursor-pointer ${isExpanded ? "bg-[#141432]/50" : ""}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.productName} className="w-10 h-10 rounded-lg object-cover bg-slate-800" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-[#a5a5c8] font-bold">
                                N/A
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-white block">{p.productName}</span>
                              <span className="text-[10px] text-[#a5a5c8] block mt-0.5">{p.productId.substring(0, 8)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[#a5a5c8]">{p.sku}</td>
                        <td className="p-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              p.dataQuality.status === "HIGH" 
                                ? "bg-[#24C78E]/10 text-[#24C78E]" 
                                : p.dataQuality.status === "MEDIUM"
                                ? "bg-yellow-400/10 text-yellow-400"
                                : "bg-red-400/10 text-red-400"
                            }`}>
                              {p.dataQuality.confidenceScore}% ({p.dataQuality.status === "HIGH" ? "عالية" : p.dataQuality.status === "MEDIUM" ? "متوسطة" : "منخفضة"})
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-[#6366f1]">
                              {p.totals.deliveryRate !== null ? `${p.totals.deliveryRate.toFixed(1)}%` : "-"}
                            </span>
                            <span className="text-[9px] text-[#a5a5c8]/70 font-medium">
                              (دفعة: {p.perBatchTotals?.deliveryRate !== null ? `${p.perBatchTotals.deliveryRate.toFixed(1)}%` : "-"})
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`font-bold ${p.totals.returnRate !== null && p.totals.returnRate > 25 ? "text-red-400" : "text-slate-300"}`}>
                              {p.totals.returnRate !== null ? `${p.totals.returnRate.toFixed(1)}%` : "-"}
                            </span>
                            <span className="text-[9px] text-[#a5a5c8]/70 font-medium">
                              (دفعة: {p.perBatchTotals?.returnRate !== null ? `${p.perBatchTotals.returnRate.toFixed(1)}%` : "-"})
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-white">{p.totals.weeklyWithdrawals}</td>
                        <td className="p-4 text-center text-orange-400 font-semibold">{p.totals.estimatedReturns}</td>
                        <td className="p-4 text-center text-slate-400">{p.totals.unclassifiedIncreases}</td>
                        <td className="p-4 text-center">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[#a5a5c8] mx-auto" /> : <ChevronDown className="w-4 h-4 text-[#a5a5c8] mx-auto" />}
                        </td>
                      </tr>

                      {/* Expandable Panel */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0 bg-[#0a0a1a]/30 border-b border-[#2a2a5c]">
                            <div className="p-5 space-y-5 text-right">
                              
                              {/* 1. Audit Alerts */}
                              <div>
                                <h4 className="text-[11px] font-bold text-[#f5f5fa] mb-3 flex items-center gap-1.5">
                                  <TriangleAlert className="w-4 h-4 text-yellow-400" />
                                  نتائج فحص سلامة البيانات للبيئة
                                </h4>
                                {p.dataQuality.issues.length === 0 ? (
                                  <div className="bg-[#1c1c47]/40 p-3 rounded-lg border border-[#2a2a5c] text-emerald-400 text-[11px] flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    لم يتم الكشف عن أي انحرافات أو ثغرات في حركة مخزون هذا المنتج للأسبوع المحدد.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {p.dataQuality.issues.map((issue: any, index: number) => (
                                      <div 
                                        key={index} 
                                        className={`p-3 rounded-lg border flex gap-3 text-[11px] ${
                                          issue.severity === "CRITICAL" 
                                            ? "bg-red-500/10 border-red-500/20 text-red-300" 
                                            : issue.severity === "WARNING"
                                            ? "bg-yellow-400/10 border-yellow-400/20 text-yellow-300"
                                            : "bg-[#2a2a5c]/40 border-[#2a2a5c] text-[#a5a5c8]"
                                        }`}
                                      >
                                        <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-extrabold block">{issue.type}</span>
                                          <span className="block mt-0.5 leading-relaxed">{issue.message}</span>
                                          {issue.checkedAt && (
                                            <span className="text-[9px] text-[#a5a5c8]/70 block mt-1">تاريخ الرصد: {issue.checkedAt}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Product Methodology Comparison */}
                              <div className="bg-[#1c1c47]/20 p-4 rounded-xl border border-[#2a2a5c] space-y-3 text-right">
                                <h4 className="text-[11px] font-bold text-[#f5f5fa] flex items-center gap-1.5">
                                  <Scale className="w-4 h-4 text-[#6366f1]" />
                                  مقارنة وتطابق النسب الحسابية للمنهجيات المختلفة
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div className="bg-[#0f0f24] p-3 rounded-lg border border-[#2a2a5c]/40">
                                    <span className="text-[#a5a5c8] block text-[10px]">نسبة التسليم (المدقق المتقاطع)</span>
                                    <span className="font-bold text-[#6366f1] text-sm">
                                      {p.totals.deliveryRate !== null ? `${p.totals.deliveryRate.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block mt-0.5">تسليم {p.totals.netDelivered} قطعة</span>
                                  </div>
                                  <div className="bg-[#0f0f24] p-3 rounded-lg border border-[#2a2a5c]/40">
                                    <span className="text-[#a5a5c8] block text-[10px]">نسبة التسليم (ملخص الدفعات)</span>
                                    <span className="font-bold text-[#6366f1] text-sm">
                                      {p.perBatchTotals?.deliveryRate !== null ? `${p.perBatchTotals.deliveryRate.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block mt-0.5">تسليم {p.perBatchTotals?.netDelivered} قطعة</span>
                                  </div>
                                  <div className="bg-[#0f0f24] p-3 rounded-lg border border-[#2a2a5c]/40">
                                    <span className="text-[#a5a5c8] block text-[10px]">نسبة الاسترجاع (المدقق المتقاطع)</span>
                                    <span className="font-bold text-red-400 text-sm">
                                      {p.totals.returnRate !== null ? `${p.totals.returnRate.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">استرجع {p.totals.estimatedReturns} قطعة</span>
                                  </div>
                                  <div className="bg-[#0f0f24] p-3 rounded-lg border border-[#2a2a5c]/40">
                                    <span className="text-[#a5a5c8] block text-[10px]">نسبة الاسترجاع (ملخص الدفعات)</span>
                                    <span className="font-bold text-red-400 text-sm">
                                      {p.perBatchTotals?.returnRate !== null ? `${p.perBatchTotals.returnRate.toFixed(1)}%` : "-"}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">استرجع {p.perBatchTotals?.estimatedReturns} قطعة</span>
                                  </div>
                                </div>
                              </div>

                              {/* 2. Movement Trace Log */}
                              <div>
                                <h4 className="text-[11px] font-bold text-[#f5f5fa] mb-3 flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-[#6366f1]" />
                                  سجل تتبع وتصنيف الحركات الدقيق (الحساب التراكمي لغرفة المقاصة)
                                </h4>
                                {p.movements.length === 0 ? (
                                  <p className="text-[11px] text-[#a5a5c8] bg-[#0f0f24] p-3 rounded-lg border border-[#2a2a5c]">
                                    لم تسجل أي حركات زيادة أو نقصان للمنتج خلال هذا الأسبوع.
                                  </p>
                                ) : (
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {p.movements.map((m: any, index: number) => {
                                      const isDecrease = m.quantityChange < 0;
                                      return (
                                        <div 
                                          key={index}
                                          className="bg-[#0f0f24] p-3 rounded-lg border border-[#2a2a5c] flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-[11px]"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                              m.classifiedAs === "WITHDRAWAL"
                                                ? "bg-blue-400/10 text-blue-400"
                                                : m.classifiedAs === "CONFIRMED_RESTOCK"
                                                ? "bg-emerald-400/10 text-emerald-400"
                                                : m.classifiedAs === "ESTIMATED_RETURN"
                                                ? "bg-orange-400/10 text-orange-400"
                                                : "bg-slate-400/10 text-slate-400"
                                            }`}>
                                              {m.classifiedAs}
                                            </span>
                                            <span className="font-mono text-[#a5a5c8]">{m.checkedAt}</span>
                                          </div>
                                          
                                          <div className="flex-1 md:text-right font-medium text-white px-2">
                                            {m.reason}
                                          </div>

                                          <div className="flex items-center gap-4 text-left self-end md:self-auto">
                                            <div className="text-right">
                                              <span className="text-[9px] text-[#a5a5c8] block">التغيير بالقطع</span>
                                              <span className={`font-mono font-bold ${isDecrease ? "text-red-400" : "text-[#24C78E]"}`}>
                                                {isDecrease ? "" : "+"}{m.quantityChange}
                                              </span>
                                            </div>
                                            <div className="text-right">
                                              <span className="text-[9px] text-[#a5a5c8] block">مخزون الرصيد</span>
                                              <span className="font-mono font-bold text-[#f5f5fa]">
                                                {m.currentQuantity}
                                              </span>
                                            </div>
                                            <div className="text-right">
                                              <span className="text-[9px] text-[#a5a5c8] block">رصيد السحب المعلق</span>
                                              <span className="font-mono font-bold text-yellow-400">
                                                {m.pendingWithdrawalBalanceAfter}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Algorithm Panel */}
      <div className="bg-[#0a0a1a]/60 rounded-2xl border border-[#2a2a5c] p-5 space-y-4">
        <h3 className="text-sm font-bold text-[#f5f5fa] flex items-center gap-1.5">
          <CircleHelp className="w-5 h-5 text-[#6366f1]" />
          منهجية وخوارزمية تدقيق الاسترجاع والتسليم (Balance verification algorithm)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div className="space-y-3">
            <h4 className="font-bold text-[#6366f1] flex items-center gap-1">
              <Info className="w-4 h-4" />
              كيف تُحسب المرتجعات التقديرية؟
            </h4>
            <p className="text-[#a5a5c8] leading-relaxed">
              تعتمد الخوارزمية على فكرة <strong>تتبع السحب المعلق</strong>. عندما يقل مخزون منتج، يتم تصنيف هذا النقص كعملية <strong>سحب (طلب شحن)</strong>، ويتم إضافته إلى رصيد معلق.
            </p>
            <p className="text-[#a5a5c8] leading-relaxed">
              إذا ارتفع المخزون لاحقًا بدون وجود <strong>علامة إعادة تخزين صريحة ومؤكدة</strong>، يُعتبر هذا الارتفاع بمثابة <strong>مرتجع تقديري (Estimated Return)</strong> بحد أقصى لا يتجاوز الرصيد المعلق المسحوب مسبقًا. أما عمليات <strong>إعادة التخزين والتوريد المؤكدة</strong> فيتم تتبعها بشكل منفصل تمامًا دون تصفير رصيد السحب المعلق، مما يتيح تتبع المرتجعات اللاحقة ومطابقتها بدقة متناهية.
            </p>
            <div className="bg-[#0f0f24] p-3 rounded-lg border border-[#2a2a5c] text-[11px] text-yellow-300">
              🚨 <strong>ملاحظة هامة حول الدقة:</strong> تُعتبر المرتجعات <strong>تقديرية وليست يقينية بنسبة 100%</strong> لعدم توفر تصنيف منفصل في المصادر لكل زيادة مخزون، والاعتماد بالكامل على مقارنة حركة المخزون وتصفية التوريد المؤكد.
            </div>
          </div>

          <div className="space-y-4 bg-[#0f0f24]/60 p-4 rounded-xl border border-[#2a2a5c]/80">
            <div>
              <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1">الخوارزمية المعتمدة</span>
              <span className="text-xs font-bold text-[#f5f5fa] block">{algorithm.name} v{algorithm.version}</span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-[#a5a5c8] font-bold block">المعادلات الرياضية المطبقة</span>
              <div className="bg-[#0f0f24] p-2.5 rounded border border-[#2a2a5c] font-mono text-[10px] text-[#6366f1] space-y-1">
                <div>netDelivered = max(weeklyWithdrawals - estimatedReturns, 0)</div>
                <div>deliveryRate = weeklyWithdrawals &gt; 0 ? (netDelivered / weeklyWithdrawals * 100) : null</div>
                <div>returnRate = weeklyWithdrawals &gt; 0 ? (estimatedReturns / weeklyWithdrawals * 100) : null</div>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#a5a5c8] font-bold block mb-1.5">محددات الخوارزمية لشفافية البيانات</span>
              <ul className="list-disc list-inside space-y-1 text-[#a5a5c8] text-[11px] pr-2">
                {algorithm.limitations.map((limit: string, idx: number) => (
                  <li key={idx}>{limit}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
