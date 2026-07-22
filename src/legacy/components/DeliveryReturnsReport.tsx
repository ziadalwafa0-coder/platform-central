import React, { useState, useEffect } from "react";
import { PackageSearch, ArrowDownLeft, ArrowUpRight, Activity, Percent, ArrowRightLeft, Info, Calendar, List, CalendarDays } from "lucide-react";
import { safeFetchJson } from "../lib/api";
import { DateRangePicker } from "./DateRangePicker";

interface DeliveryReturnsReportProps {
  productId: string;
}

export function DeliveryReturnsReport({ productId }: DeliveryReturnsReportProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "daily" | "movements">("summary");

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
    fetchReport();
  }, [productId, weekStart, weekEnd]);

  const fetchReport = async () => {
    if (weekStart > weekEnd) {
      setError("تاريخ البدء لا يمكن أن يكون بعد تاريخ الانتهاء (يرجى اختيار نطاق تاريخ صحيح)");
      setReport(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await safeFetchJson(`/api/products/${productId}/delivery-returns-report?weekStart=${weekStart}&weekEnd=${weekEnd}`);
      if (!res.success) throw new Error(res.error || "Failed to load report");
      setReport(res.report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <h4 className="text-xs font-extrabold text-[#F4F7FB] flex items-center gap-2">
        <PackageSearch className="w-4 h-4 text-[#E879F9]" />
        تحليل تسليم واسترجاع الشحنات
      </h4>

      <div className="bg-[#07111F]/60 p-4 rounded-xl border border-[#20324A] text-xs">
        <div className="flex justify-between items-center mb-4">
          <div className="flex bg-[#0B1424] rounded-lg p-1 border border-[#20324A]">
            <button 
              onClick={() => setActiveTab("summary")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeTab === "summary" ? "bg-[#20324A] text-white" : "text-[#9FB0C5]"}`}
            >
              ملخص التقرير
            </button>
            <button 
              onClick={() => setActiveTab("daily")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeTab === "daily" ? "bg-[#20324A] text-white" : "text-[#9FB0C5]"}`}
            >
              تحليل يومي
            </button>
            <button 
              onClick={() => setActiveTab("movements")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeTab === "movements" ? "bg-[#20324A] text-white" : "text-[#9FB0C5]"}`}
            >
              سجل الحركات
            </button>
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

        {loading ? (
          <div className="text-center py-6 text-[#9FB0C5] flex items-center justify-center gap-2">
            <Activity className="w-4 h-4 animate-spin" />
            جاري تحليل البيانات...
          </div>
        ) : error ? (
          <div className="text-red-400 py-4 text-center">{error}</div>
        ) : report ? (
          <div className="space-y-4">
            {activeTab === "summary" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-[#0B1424] p-3 rounded-lg border border-[#20324A]">
                    <div className="text-[10px] text-[#9FB0C5] flex items-center gap-1 mb-1">
                      <Percent className="w-3 h-3 text-[#24C78E]" />
                      نسبة التسليم
                    </div>
                    <div className="text-[#24C78E] font-bold text-lg">
                      {report.totals.deliveryRate !== null ? `${report.totals.deliveryRate.toFixed(1)}%` : "-"}
                    </div>
                  </div>
                  <div className="bg-[#0B1424] p-3 rounded-lg border border-[#20324A]">
                    <div className="text-[10px] text-[#9FB0C5] flex items-center gap-1 mb-1">
                      <ArrowRightLeft className="w-3 h-3 text-red-400" />
                      نسبة المرتجعات
                    </div>
                    <div className="text-red-400 font-bold text-lg">
                      {report.totals.returnRate !== null ? `${report.totals.returnRate.toFixed(1)}%` : "-"}
                    </div>
                  </div>
                  <div className="bg-[#0B1424] p-3 rounded-lg border border-[#20324A]">
                    <div className="text-[10px] text-[#9FB0C5] flex items-center gap-1 mb-1">
                      <ArrowDownLeft className="w-3 h-3 text-[#2F80FF]" />
                      إجمالي السحوبات
                    </div>
                    <div className="text-white font-bold text-lg">
                      {report.totals.weeklyWithdrawals}
                    </div>
                  </div>
                  <div className="bg-[#0B1424] p-3 rounded-lg border border-[#20324A]">
                    <div className="text-[10px] text-[#9FB0C5] flex items-center gap-1 mb-1">
                      <Info className="w-3 h-3 text-yellow-400" />
                      مرتجعات متوقعة*
                    </div>
                    <div className="text-white font-bold text-lg">
                      {report.totals.estimatedReturns}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 items-center bg-[#20324A]/20 p-2 rounded-lg text-[10px] text-[#9FB0C5] flex-wrap">
                  <div className="bg-[#07111F]/50 px-2 py-1 rounded">صافي مسلّم: <strong className="text-white">{report.totals.netDelivered}</strong></div>
                  <div className="bg-[#07111F]/50 px-2 py-1 rounded">استوك/شحن مؤكد: <strong className="text-white">{report.totals.confirmedRestock}</strong></div>
                  <div className="bg-[#07111F]/50 px-2 py-1 rounded">تزويد غير مصنف: <strong className="text-white">{report.totals.unclassifiedIncreases}</strong></div>
                  <div className="bg-[#07111F]/50 px-2 py-1 rounded">رصيد قيد الانتظار: <strong className="text-white">{report.totals.pendingWithdrawalBalanceEnd}</strong></div>
                </div>

                {report.totals.confirmedRestock > 0 && (
                  <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 text-yellow-400 text-[10px] flex items-start gap-1.5 leading-relaxed">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div>
                      <strong>تنبيه فروق الحساب (منهجية التصفير):</strong> يحتوي هذا المنتج على شحنة توريد/استوك مؤكدة في هذه الفترة. تقرير الملخص الحالي يصفر رصيد السحب عند كل شحنة توريد (Per-batch matching)، بينما مدقق الاسترجاع التفصيلي يطابق المرتجعات بشكل متقاطع (Cross-restock matching)، مما قد يسبب اختلافاً في نسب التسليم والاسترجاع بين الشاشتين.
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "daily" && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[10px]">
                  <thead>
                    <tr className="text-[#9FB0C5] border-b border-[#20324A] pb-2">
                      <th className="font-medium p-2">التاريخ</th>
                      <th className="font-medium p-2">سحوبات</th>
                      <th className="font-medium p-2">مرتجعات*</th>
                      <th className="font-medium p-2">شحن استوك</th>
                      <th className="font-medium p-2">صافي مسلّم</th>
                      <th className="font-medium p-2">معدل التسليم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#20324A]/50">
                    {report.days.map((d: any) => (
                      <tr key={d.date} className="hover:bg-[#20324A]/10 transition-colors">
                        <td className="p-2 font-mono">{d.date}</td>
                        <td className="p-2 text-[#2F80FF] font-bold">{d.withdrawals}</td>
                        <td className="p-2 text-yellow-400">{d.estimatedReturns}</td>
                        <td className="p-2 text-emerald-400">{d.confirmedRestock + d.unclassifiedIncreases}</td>
                        <td className="p-2 font-bold">{d.netDelivered}</td>
                        <td className="p-2">
                          {d.deliveryRate !== null ? (
                            <span className={d.deliveryRate > 70 ? "text-[#24C78E]" : d.deliveryRate > 40 ? "text-yellow-400" : "text-red-400"}>
                              {d.deliveryRate.toFixed(0)}%
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                    {report.days.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-4 text-[#9FB0C5]">لا توجد بيانات يومية في هذه الفترة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "movements" && (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-right text-[10px]">
                  <thead className="sticky top-0 bg-[#0B1424] z-10">
                    <tr className="text-[#9FB0C5] border-b border-[#20324A] pb-2">
                      <th className="font-medium p-2">الوقت</th>
                      <th className="font-medium p-2">التغيير</th>
                      <th className="font-medium p-2">التصنيف</th>
                      <th className="font-medium p-2">دورة الحساب</th>
                      <th className="font-medium p-2">الرصيد المعلق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#20324A]/50">
                    {report.movements.map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#20324A]/10 transition-colors">
                        <td className="p-2 font-mono whitespace-nowrap">{new Date(m.checkedAt).toLocaleString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-2 font-mono" dir="ltr">
                          <span className={m.quantityChange > 0 ? "text-emerald-400" : "text-red-400"}>
                            {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                          </span>
                        </td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded ${
                            m.classifiedAs === "WITHDRAWAL" ? "bg-blue-500/10 text-blue-400" :
                            m.classifiedAs === "ESTIMATED_RETURN" ? "bg-yellow-500/10 text-yellow-400" :
                            m.classifiedAs === "CONFIRMED_RESTOCK" ? "bg-emerald-500/10 text-emerald-400" :
                            "bg-gray-500/10 text-gray-400"
                          }`}>
                            {m.classifiedAs}
                          </span>
                        </td>
                        <td className="p-2 text-center">{m.cycleId}</td>
                        <td className="p-2 font-mono">{m.pendingWithdrawalBalanceAfter}</td>
                      </tr>
                    ))}
                    {report.movements.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center p-4 text-[#9FB0C5]">لا توجد حركات مخزون في هذه الفترة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-[9px] text-[#9FB0C5]/70 italic mt-2 border-t border-[#20324A]/50 pt-2 flex items-start gap-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{report.note}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
