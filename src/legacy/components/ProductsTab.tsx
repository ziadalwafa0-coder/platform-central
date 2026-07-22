// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Info,
  Clock,
  Calendar
} from "lucide-react";
import { Product } from "../types";
import { formatCairoTime } from "../shared/time";
import { addDaysToDateStr, getCairoTodayStr, getCairoYesterdayStr } from "../shared/time";
import { safeFetchJson } from "../lib/api";
import { DateRangePicker } from "./DateRangePicker";

interface ProductsTabProps {
  products: Product[];
  categories: string[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  onProductClick: (p: Product) => void;
  selectedPlatform?: string;
  defaultDate?: string;
}

type SortField = "name" | "price" | "withdrawnPieces" | "withdrawalEvents" | "lastCheckedAt";
type SortOrder = "asc" | "desc";

export default function ProductsTab({
  categories,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedStatus,
  setSelectedStatus,
  onProductClick,
  selectedPlatform,
  defaultDate
}: ProductsTabProps) {

  const getOffsetDateStr = (dateStr: string, offset: number) => {
    return addDaysToDateStr(dateStr, offset);
  };

  // Sync date selection state with URL query param
  const getInitialStartDate = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlDate = params.get("date");
      const today = defaultDate || getCairoTodayStr();
      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
        if (urlDate <= today) {
          return urlDate;
        }
      }
      return today;
    } catch {
      return defaultDate || getCairoTodayStr();
    }
  };

  const getInitialEndDate = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToDate = params.get("toDate");
      const today = defaultDate || getCairoTodayStr();
      if (urlToDate && /^\d{4}-\d{2}-\d{2}$/.test(urlToDate)) {
        if (urlToDate <= today) {
          return urlToDate;
        }
      }
      const urlDate = params.get("date");
      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) && urlDate <= today) {
        return urlDate;
      }
      return today;
    } catch {
      return defaultDate || getCairoTodayStr();
    }
  };

  const [startDate, setStartDate] = useState<string>(() => getInitialStartDate());
  const [endDate, setEndDate] = useState<string>(() => getInitialEndDate());

  const displayDateRange = useMemo(() => {
    if (startDate === endDate) {
      return `في تاريخ ${startDate}`;
    }
    return `في الفترة من ${startDate} إلى ${endDate}`;
  }, [startDate, endDate]);

  const [activityProducts, setActivityProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    totalWithdrawnPieces: number;
    totalWithdrawalEvents: number;
    affectedProductsCount: number;
  } | null>(null);

  useEffect(() => {
    if (defaultDate) {
      setStartDate(defaultDate);
      setEndDate(defaultDate);
      setCurrentPage(1);
    }
  }, [defaultDate]);

  // Table pagination, sorting, and UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>("withdrawnPieces");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Fetch date activity on filters or date change
  useEffect(() => {
    const fetchActivity = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          date: startDate,
          toDate: endDate,
          platform: selectedPlatform || "all",
          category: selectedCategory || "all",
          search: searchQuery || "",
          sortBy: sortField === "withdrawnPieces" ? "withdrawn_pieces" : sortField === "withdrawalEvents" ? "withdrawal_events" : sortField === "lastCheckedAt" ? "last_withdrawal_at" : sortField,
          sortOrder: sortOrder,
          limit: "1000" // Higher limit to fetch all active rows for client side processing
        });
        
        const data = await safeFetchJson<any>(`/api/products/withdrawal-activity?${params.toString()}`);
        if (data.success) {
          setActivityProducts(data.products || []);
          setMetrics(data.metrics || {
            totalWithdrawnPieces: 0,
            totalWithdrawalEvents: 0,
            affectedProductsCount: 0
          });
        } else {
          setError(data.error || "Failed to load data");
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [startDate, endDate, selectedPlatform, selectedCategory, searchQuery]);

  // Synchronize URL query parameters when date range changes
  const handleDateRangeChange = (start: string, end: string) => {
    const today = defaultDate || getCairoTodayStr();
    if (start > today) return; // Prevent selecting future dates
    setStartDate(start);
    setEndDate(end);
    setCurrentPage(1);
    
    // Update URL query params
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("date", start);
      url.searchParams.set("toDate", end);
      window.history.replaceState({}, "", url.toString());
    } catch (e) {
      console.error("Error setting URL query parameter:", e);
    }
  };

  // Format Cairo times for display
  const formatTimeArabic = (isoString: string | undefined) => {
    if (!isoString) return "--";
    return formatCairoTime(isoString);
  };

  // Handle headers sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // Perform client-side status filtering on the fetched date activity
  const filteredProducts = useMemo(() => {
    return activityProducts.filter((p) => {
      // 1. Status Filter
      let matchesStatus = true;
      if (selectedStatus === "QUANTITY_DECREASE") {
        matchesStatus = (p.withdrawnPieces !== undefined && p.withdrawnPieces > 0);
      } else if (selectedStatus === "LOW_STOCK") {
        matchesStatus = (p.currentQuantity !== null && p.currentQuantity !== undefined && p.currentQuantity <= 20 && p.currentQuantity > 0);
      } else if (selectedStatus === "OUT_OF_STOCK") {
        matchesStatus = (p.currentQuantity !== null && p.currentQuantity !== undefined && p.currentQuantity === 0);
      } else if (selectedStatus === "STABLE") {
        matchesStatus = (!p.withdrawnPieces);
      } else if (selectedStatus === "RESTOCKED") {
        matchesStatus = false; // Restocks are not captured on historical withdrawal days
      }

      return matchesStatus;
    });
  }, [activityProducts, selectedStatus]);

  // Perform client-side Sorting
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" 
          ? valA.localeCompare(valB, "ar") 
          : valB.localeCompare(valA, "ar");
      }

      return sortOrder === "asc" ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
    return list;
  }, [filteredProducts, sortField, sortOrder]);

  // Perform client-side Pagination
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedProducts.length / pageSize) || 1;

  // Handle Export CSV
  const handleExportCSV = () => {
    try {
      const dateStrForFile = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
      const displayPeriod = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
      
      const headers = [
        "Product Name", 
        "SKU", 
        "Category", 
        "Platform", 
        "Wholesale Price", 
        `Withdrawn Pieces (Cairo: ${displayPeriod})`, 
        `Withdrawal Events (Cairo: ${displayPeriod})`, 
        "Last Withdrawal At",
        "Current Stock"
      ];
      const rows = filteredProducts.map((p) => [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.sku}"`,
        `"${p.category || ""}"`,
        `"${p.platform || "Safka eg"}"`,
        p.price,
        p.withdrawnPieces ?? 0,
        p.withdrawalEvents ?? 0,
        p.lastWithdrawalAt || "",
        p.currentQuantity ?? 0
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Stock_Radaar_Products_${dateStrForFile}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error exporting CSV:", err);
    }
  };

  const todayStr = getCairoTodayStr();

  return (
    <div className="space-y-5">

      {/* Date-Sensitive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Pieces Withdrawn */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-2 relative overflow-hidden group hover:border-[#2F80FF]/30 transition-all duration-300">
          <div className="absolute top-0 right-0 h-[2px] w-full bg-gradient-to-l from-transparent via-[#24C78E]/50 to-transparent"></div>
          <span className="text-[11px] text-[#9FB0C5] font-extrabold block">إجمالي القطع المسحوبة</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl text-[#24C78E] font-black font-mono">
              {loading ? "..." : (metrics?.totalWithdrawnPieces || 0)}
            </strong>
            <span className="text-[10px] text-[#9FB0C5]">قطع</span>
          </div>
          <p className="text-[9px] text-[#9FB0C5]/50 font-medium">{displayDateRange}</p>
        </div>

        {/* Total Withdrawal Events */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-2 relative overflow-hidden group hover:border-[#2F80FF]/30 transition-all duration-300">
          <div className="absolute top-0 right-0 h-[2px] w-full bg-gradient-to-l from-transparent via-[#8B5CF6]/50 to-transparent"></div>
          <span className="text-[11px] text-[#9FB0C5] font-extrabold block">إجمالي عمليات الرصد</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl text-white font-black font-mono">
              {loading ? "..." : (metrics?.totalWithdrawalEvents || 0)}
            </strong>
            <span className="text-[10px] text-[#9FB0C5]">عملية سحب</span>
          </div>
          <p className="text-[9px] text-[#9FB0C5]/50 font-medium">{displayDateRange}</p>
        </div>

        {/* Affected Products Count */}
        <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl space-y-2 relative overflow-hidden group hover:border-[#2F80FF]/30 transition-all duration-300">
          <div className="absolute top-0 right-0 h-[2px] w-full bg-gradient-to-l from-transparent via-[#F5A524]/50 to-transparent"></div>
          <span className="text-[11px] text-[#9FB0C5] font-extrabold block">المنتجات المتأثرة بالسحب</span>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className="text-2xl text-[#F5A524] font-black font-mono">
              {loading ? "..." : (metrics?.affectedProductsCount || 0)}
            </strong>
            <span className="text-[10px] text-[#9FB0C5]">منتج فريد</span>
          </div>
          <p className="text-[9px] text-[#9FB0C5]/50 font-medium">{displayDateRange}</p>
        </div>

      </div>
      
      {/* Filters Area */}
      <div className="bg-[#0D1B2D] border border-[#20324A] p-5 rounded-3xl">
        <div className="flex flex-col xl:flex-row gap-4 items-stretch justify-between">
          
          {/* Right Side: Search & Date Controls */}
          <div className="flex flex-col md:flex-row gap-3 flex-1">
            
            {/* Text search query */}
            <div className="relative flex-1 min-w-[200px]">
              <input 
                type="text" 
                placeholder="ابحث باسم السلعة أو كود الـ SKU..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-11 bg-[#07111F] border border-[#20324A] rounded-xl pr-10 pl-4 text-xs text-white placeholder-[#9FB0C5]/50 outline-none focus:border-[#2F80FF] transition-all font-medium text-right font-sans"
              />
              <Search className="w-4 h-4 text-[#9FB0C5] absolute right-3.5 top-3.5" />
            </div>

            {/* Date Selector Widget */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateRangeChange}
              align="right"
              className="flex items-center gap-2 bg-[#07111F] hover:bg-[#12233A] text-white px-3 h-11 rounded-xl border border-[#20324A] text-xs font-semibold cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-[#2F80FF]"
            />
          </div>

          {/* Left Side: Selectors & Export */}
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center shrink-0">
            
            {/* Category Dropdown filter */}
            <div className="w-[140px]">
              <select 
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#07111F] border border-[#20324A] h-11 rounded-xl px-3 text-xs text-[#F4F7FB] outline-none focus:border-[#2F80FF] font-bold cursor-pointer"
              >
                <option value="all">جميع التصنيفات</option>
                {categories.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Status Dropdown filter */}
            <div className="w-[140px]">
              <select 
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#07111F] border border-[#20324A] h-11 rounded-xl px-3 text-xs text-[#F4F7FB] outline-none focus:border-[#2F80FF] font-bold cursor-pointer"
              >
                <option value="all">جميع الحالات</option>
                <option value="QUANTITY_DECREASE">المنخفضة بالكمية</option>
                <option value="LOW_STOCK">المنخفضة بالمستودع (تحت ٢٠)</option>
                <option value="OUT_OF_STOCK">النافدة تماماً بالمستودع</option>
                <option value="STABLE">المستقرة اليوم</option>
              </select>
            </div>

            {/* Actions: Export to CSV */}
            <div>
              <button 
                onClick={handleExportCSV}
                className="h-11 px-4 bg-[#12233A] hover:bg-[#20324A] border border-[#20324A] text-xs text-[#F4F7FB] hover:text-[#2F80FF] rounded-xl transition duration-150 font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تصدير CSV</span>
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0D1B2D] border border-[#20324A] rounded-3xl overflow-hidden shadow-2xl">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-8 h-8 border-4 border-[#2F80FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-[#9FB0C5] font-bold">جاري تحميل بيانات السحوبات والتحليلات...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 space-y-2">
            <div className="bg-[#F05252]/10 p-3 rounded-full border border-[#F05252]/20 text-[#F05252]">
              <Info className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">حدث خطأ في جلب البيانات</h3>
            <p className="text-xs text-[#9FB0C5]/80 max-w-md">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#07111F]/60 text-[#9FB0C5] text-xs font-bold border-b border-[#20324A]">
                  <th className="p-4 cursor-pointer hover:text-white transition" onClick={() => handleSort("name")}>
                    <div className="flex items-center gap-1.5">
                      <span>اسم السلعة والتفاصيل</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="p-4 font-mono">الـ SKU</th>
                  <th className="p-4">التصنيف</th>
                  
                  {/* Historical Date Columns */}
                  <th className="p-4 text-center cursor-pointer hover:text-white transition" onClick={() => handleSort("withdrawnPieces")}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>القطع المسحوبة (اليوم)</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="p-4 text-center cursor-pointer hover:text-white transition" onClick={() => handleSort("withdrawalEvents")}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>عمليات السحب</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="p-4 text-center cursor-pointer hover:text-white transition" onClick={() => handleSort("price")}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>سعر الجملة</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  
                  <th className="p-4 text-center cursor-pointer hover:text-white transition" onClick={() => handleSort("lastCheckedAt")}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>آخر عملية رصد سحب</span>
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </div>
                  </th>
                  <th className="p-4 text-center">التحليل التفصيلي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20324A]/40 text-xs text-[#F4F7FB]">
                {paginatedProducts.map((p) => {
                  const isLow = p.currentQuantity !== null && p.currentQuantity !== undefined && p.currentQuantity <= 20 && p.currentQuantity > 0;
                  const isOut = p.currentQuantity !== null && p.currentQuantity !== undefined && p.currentQuantity === 0;

                  return (
                    <tr 
                      key={p.id} 
                      className="hover:bg-[#12233A]/25 transition duration-150"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={p.imageUrl} 
                            className="w-11 h-11 rounded-lg object-cover bg-[#07111F] shrink-0 border border-[#20324A]/50" 
                            alt="" 
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <h4 
                              onClick={() => onProductClick(p)}
                              className="font-black text-[#F4F7FB] text-[12.5px] hover:text-[#2F80FF] transition cursor-pointer"
                            >
                              {p.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-[#9FB0C5] block">المنصة: {p.platform || "صفقة Safka EG"}</span>
                              {p.currentQuantity !== undefined && (
                                <>
                                  <span className="text-[9px] text-[#20324A]">•</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    isOut ? "text-[#F05252] bg-[#F05252]/10" :
                                    isLow ? "text-[#F5A524] bg-[#F5A524]/10" :
                                    "text-[#24C78E] bg-[#24C78E]/10"
                                  }`}>
                                    متاح: {p.currentQuantity} قطعة
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-4 font-mono text-[#9FB0C5] font-semibold">{p.sku}</td>
                      
                      <td className="p-4 text-[#9FB0C5]">{p.category}</td>
                      
                      {/* Pieces withdrawn */}
                      <td className="p-4 text-center font-mono font-bold">
                        <span className="text-[#24C78E] font-black flex items-center justify-center gap-1 bg-[#24C78E]/10 px-2.5 py-1 rounded-full text-[11px] w-fit mx-auto">
                          <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                          {p.withdrawnPieces || 0} قطع
                        </span>
                      </td>

                      {/* Withdrawal Events Count */}
                      <td className="p-4 text-center font-mono font-bold">
                        <span className="text-[#8B5CF6] font-black bg-[#8B5CF6]/10 px-2.5 py-1 rounded-full text-[11px] w-fit mx-auto">
                          {p.withdrawalEvents || 0} مرات سحب
                        </span>
                      </td>

                      <td className="p-4 text-center font-bold font-mono text-[#F4F7FB] text-[13px]">{p.price} ج.م</td>

                      {/* Last checked cairo withdrawal time */}
                      <td className="p-4 text-center text-[#9FB0C5]/80 text-[11px] font-mono">
                        <div className="flex items-center justify-center gap-1.5">
                          <Clock className="w-3 h-3 text-[#9FB0C5]/50" />
                          {formatTimeArabic(p.lastWithdrawalAt)}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <button 
                          onClick={() => onProductClick(p)}
                          className="px-3 py-1.5 rounded-lg bg-[#12233A] hover:bg-[#20324A] border border-[#20324A] text-[#F4F7FB] hover:text-[#2F80FF] transition-all cursor-pointer font-bold text-[11px]"
                        >
                          {startDate === endDate ? "تحليل اليوم" : "تحليل الفترة"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {sortedProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-20 text-[#9FB0C5] font-black text-xs bg-[#07111F]/20">
                      لا تتوفر أي سحوبات أو عمليات مطابقة مسجلة {displayDateRange} المحدد بالمعايير المدخلة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Styled Pagination footer */}
        {!loading && sortedProducts.length > 0 && (
          <div className="bg-[#07111F]/40 px-6 py-4 border-t border-[#20324A] flex justify-between items-center text-xs select-none">
            {/* Page info */}
            <div className="text-[#9FB0C5] font-medium">
              عرض من <strong className="text-white font-mono">{((currentPage - 1) * pageSize) + 1}</strong> إلى{" "}
              <strong className="text-white font-mono">{Math.min(currentPage * pageSize, sortedProducts.length)}</strong> من أصل{" "}
              <strong className="text-white font-mono">{sortedProducts.length}</strong> منتج نشط بالسحب
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-[#12233A] hover:bg-[#20324A] text-[#9FB0C5] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <span className="text-[#9FB0C5] font-bold">
                الصفحة <strong className="text-white font-mono">{currentPage}</strong> من أصل <strong className="text-white font-mono">{totalPages}</strong>
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-[#12233A] hover:bg-[#20324A] text-[#9FB0C5] disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#12233A] border border-[#20324A] text-xs text-white rounded-lg px-2 py-1 outline-none font-bold mr-2 cursor-pointer"
              >
                <option value={10}>١٠ منتجات</option>
                <option value={25}>٢٥ منتج</option>
                <option value={50}>٥٠ منتج</option>
              </select>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
