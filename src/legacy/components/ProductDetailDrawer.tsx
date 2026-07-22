// @ts-nocheck
import { DeliveryReturnsReport } from "./DeliveryReturnsReport";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Layers, 
  TrendingDown, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Info,
  Clock,
  CircleCheck,
  AlertTriangle,
  History,
  TrendingUp,
  Sliders,
  Star,
  Save,
  Trash2,
  ShieldAlert
} from "lucide-react";
import { Product } from "../types";
import { db, auth } from "../lib/firebase";
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import ProductAdsSection from "./ProductAdsSection";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ProductDetailDrawerProps {
  activeProductDetail: Product | null;
  onClose: () => void;
  selectedDate?: string;
  userId?: string;
}

export default function ProductDetailDrawer({
  activeProductDetail,
  onClose,
  selectedDate,
  userId
}: ProductDetailDrawerProps) {
  
  const [isStarred, setIsStarred] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId || !activeProductDetail) {
      setIsStarred(false);
      setAlertThreshold("");
      setNotes("");
      return;
    }

    const docPath = `users/${userId}/watchlist/${activeProductDetail.id}`;
    const docRef = doc(db, "users", userId, "watchlist", activeProductDetail.id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsStarred(true);
        setAlertThreshold(data.alertThreshold !== null && data.alertThreshold !== undefined ? data.alertThreshold : "");
        setNotes(data.notes || "");
      } else {
        setIsStarred(false);
        setAlertThreshold("");
        setNotes("");
      }
    }, (error) => {
      console.error("Error listening to watchlist item:", error);
      handleFirestoreError(error, OperationType.GET, docPath);
    });

    return () => unsubscribe();
  }, [userId, activeProductDetail]);

  const handleSaveWatchlist = async () => {
    if (!userId || !activeProductDetail) return;
    setSaving(true);
    const docPath = `users/${userId}/watchlist/${activeProductDetail.id}`;
    try {
      const docRef = doc(db, "users", userId, "watchlist", activeProductDetail.id);
      
      // Ensure all potentially undefined fields are strictly sanitized to prevent Firestore errors
      const payload = {
        productId: activeProductDetail.id || "",
        sku: activeProductDetail.sku || "",
        name: activeProductDetail.name || "",
        imageUrl: activeProductDetail.imageUrl || "",
        price: activeProductDetail.price !== undefined && activeProductDetail.price !== null ? activeProductDetail.price : null,
        currentQuantity: activeProductDetail.currentQuantity !== undefined && activeProductDetail.currentQuantity !== null ? activeProductDetail.currentQuantity : null,
        alertThreshold: alertThreshold === "" ? null : Number(alertThreshold),
        notes: notes || "",
        starredAt: serverTimestamp()
      };

      await setDoc(docRef, payload);
      setIsStarred(true);
    } catch (e) {
      console.error("Error saving to watchlist:", e);
      handleFirestoreError(e, OperationType.WRITE, docPath);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWatchlist = async () => {
    if (!userId || !activeProductDetail) return;
    setSaving(true);
    const docPath = `users/${userId}/watchlist/${activeProductDetail.id}`;
    try {
      const docRef = doc(db, "users", userId, "watchlist", activeProductDetail.id);
      await deleteDoc(docRef);
      setIsStarred(false);
      setAlertThreshold("");
      setNotes("");
    } catch (e) {
      console.error("Error removing from watchlist:", e);
      handleFirestoreError(e, OperationType.DELETE, docPath);
    } finally {
      setSaving(false);
    }
  };

  if (!activeProductDetail) return null;

  const formatTimeArabic = (isoString: string | undefined) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      const adjustedDate = new Date(d.getTime() - 60 * 60 * 1000);
      return adjustedDate.toLocaleString("ar-EG", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  // Safe variables
  const p = activeProductDetail;
  const isOutOfStock = p.currentQuantity === 0;
  const isLowStock = p.currentQuantity !== null && p.currentQuantity <= 20 && p.currentQuantity > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 cursor-pointer"
        />

        {/* Modal content body */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-[#0D1B2D] border border-[#20324A] rounded-[28px] p-6 z-55 text-right space-y-5 overflow-y-auto max-h-[90vh] shadow-2xl scrollbar-none"
        >
          {/* Header Row */}
          <div className="flex justify-between items-start gap-4 border-b border-[#20324A]/60 pb-4">
            <div className="flex items-center gap-4">
              <img 
                src={p.imageUrl} 
                className="w-16 h-16 rounded-xl object-cover bg-[#07111F] border border-[#20324A]/40 shrink-0" 
                alt="" 
                referrerPolicy="no-referrer"
              />
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-[#F4F7FB]">{p.name}</h3>
                <div className="flex flex-wrap gap-2 text-[10px] text-[#9FB0C5]">
                  <span className="font-mono">رمز الـ SKU: <strong className="text-[#F4F7FB]">{p.sku}</strong></span>
                  <span>•</span>
                  <span>المعرف: <strong className="text-[#F4F7FB]">{p.externalProductId}</strong></span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 bg-[#12233A] hover:bg-[#20324A] rounded-xl text-[#9FB0C5] hover:text-white transition cursor-pointer font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Warning disclaimer */}
          <div className="bg-[#12233A] border border-[#20324A] px-3.5 py-2.5 rounded-xl flex items-start gap-2.5 text-[10px] text-[#9FB0C5] leading-relaxed">
            <Info className="w-4 h-4 text-[#F5A524] shrink-0 mt-0.5" />
            <span>
              نقص الكميات أدناه يمثل فروق مستويات المخازن بين فترات الرصد التلقائي دورياً، وليس إثبات مبيعات مؤكدة بنسبة ١٠٠%.
            </span>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-[#07111F]/50 p-4 rounded-xl border border-[#20324A]/40">
              <span className="text-[11px] text-[#9FB0C5] block font-bold">المخزون المتوفر الكلي</span>
              <strong className={`text-xl font-mono block mt-1 ${
                isOutOfStock ? "text-[#F05252]" : isLowStock ? "text-[#F5A524]" : "text-[#24C78E]"
              }`}>
                {p.currentQuantity ?? 0} قطعة
              </strong>
            </div>
            
            <div className="bg-[#07111F]/50 p-4 rounded-xl border border-[#20324A]/40">
              <span className="text-[11px] text-[#9FB0C5] block font-bold">سعر بيع الجملة</span>
              <strong className="text-xl text-white font-mono block mt-1">
                {p.price} ج.م
              </strong>
            </div>

            <div className="bg-[#07111F]/50 p-4 rounded-xl border border-[#20324A]/40">
              <span className="text-[11px] text-[#9FB0C5] block font-bold">التصنيف بالكتالوج</span>
              <strong className="text-sm text-[#F4F7FB] block mt-2 truncate">
                {p.originalCategory || "عام"}
              </strong>
            </div>

          </div>

          {/* Hourly/Daily Decreases Tracker / Selected Date Tracker */}
          {p.withdrawnPieces !== undefined ? (
            <div className="bg-[#07111F]/40 p-4 rounded-2xl border border-[#20324A]/40 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] text-[#9FB0C5] block font-medium">سحوبات يوم {selectedDate || "المحدد"}</span>
                <strong className="text-[#24C78E] text-sm font-black block mt-1 flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4" />
                  سحب {p.withdrawnPieces || 0} قطعة
                </strong>
              </div>

              <div className="text-left">
                <span className="text-[10px] text-[#9FB0C5] block font-medium">عمليات السحب بالتاريخ</span>
                <strong className="text-[#24C78E] text-sm font-black block mt-1 flex items-center gap-1 justify-end">
                  <ArrowDownLeft className="w-4 h-4" />
                  {p.withdrawalEvents || 0} عمليات سحب
                </strong>
              </div>
            </div>
          ) : (
            <div className="bg-[#07111F]/40 p-4 rounded-2xl border border-[#20324A]/40 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] text-[#9FB0C5] block font-medium">سحوبات آخر ساعة</span>
                <strong className="text-[#24C78E] text-sm font-black block mt-1 flex items-center gap-1">
                  <ArrowDownLeft className="w-4 h-4" />
                  سحب {p.quantityDecrease || 0} قطعة
                </strong>
              </div>

              <div className="text-left">
                <span className="text-[10px] text-[#9FB0C5] block font-medium">تراكم السحوبات اليومي</span>
                <strong className="text-[#24C78E] text-sm font-black block mt-1 flex items-center gap-1 justify-end">
                  <ArrowDownLeft className="w-4 h-4" />
                  سحب {p.dailyQuantityDecrease || 0} قطعة اليوم
                </strong>
              </div>
            </div>
          )}

          {/* Firestore Watchlist & Notes Panel */}
          {userId && (
            <div className={`p-5 rounded-2xl border transition-all ${
              isStarred 
                ? "bg-[#2F80FF]/5 border-[#2F80FF]/30 shadow-lg shadow-[#2F80FF]/5" 
                : "bg-[#07111F]/30 border-[#20324A]/40"
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-extrabold text-[#F4F7FB] flex items-center gap-2">
                  <Star className={`w-4 h-4 ${isStarred ? "text-yellow-400 fill-yellow-400" : "text-[#9FB0C5]"}`} />
                  مراقبة السلعة الخاصة والإنذارات (مزامنة Firestore)
                </h4>
                {isStarred && (
                  <span className="text-[9px] px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md font-bold">
                    قيد المراقبة السحابية
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#9FB0C5] block font-bold">حد تنبيه المخزون (تنبيه ذكي)</label>
                    <input
                      type="number"
                      placeholder="مثال: 15 قطعة"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-10 bg-[#07111F]/50 border border-[#20324A] rounded-xl px-3 text-xs font-mono text-white outline-none focus:border-[#2F80FF]/50 text-right"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#9FB0C5] block font-bold">ملاحظات مسؤول المبيعات</label>
                    <textarea
                      placeholder="اكتب أي ملاحظات تسويقية أو تواصل مع الموردين هنا..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={1}
                      className="w-full min-h-[40px] max-h-[120px] bg-[#07111F]/50 border border-[#20324A] rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#2F80FF]/50 text-right"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  {isStarred && (
                    <button
                      onClick={handleRemoveWatchlist}
                      disabled={saving}
                      className="px-3 h-9 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-bold rounded-lg border border-red-500/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      إلغاء المراقبة
                    </button>
                  )}
                  <button
                    onClick={handleSaveWatchlist}
                    disabled={saving}
                    className="px-4 h-9 bg-gradient-to-l from-[#2F80FF] to-[#1F62C4] hover:from-[#4090FF] hover:to-[#2B73DD] text-white text-[11px] font-black rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isStarred ? "تحديث التعديلات" : "إضافة للمراقبة"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Variants section (sizes, colors, custom attributes) */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-[#F4F7FB] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#2F80FF]" />
              كميات الخيارات الفرعية بالكتالوج (Variants)
            </h4>
            
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {p.variants && p.variants.map((v) => {
                const vLow = (v.currentQuantity || 0) <= 20;
                return (
                  <div 
                    key={v.externalVariantId} 
                    className="bg-[#07111F]/40 p-3 rounded-xl flex justify-between items-center text-xs border border-[#20324A]/30 hover:border-[#20324A] transition"
                  >
                    <span className="text-[#F4F7FB] font-bold">{v.name}</span>
                    <div className="flex gap-6 items-center">
                      <span className="text-[#9FB0C5] font-mono">{v.price} ج.م</span>
                      <strong className={`font-mono ${vLow ? "text-[#F5A524]" : "text-[#24C78E]"}`}>
                        {v.currentQuantity !== null ? `${v.currentQuantity} قطعة متوفرة` : "غير متوفر"}
                      </strong>
                    </div>
                  </div>
                );
              })}

              {(!p.variants || p.variants.length === 0) && (
                <div className="text-center py-6 text-xs text-[#9FB0C5]/60 bg-[#07111F]/20 rounded-xl border border-dashed border-[#20324A]/30">
                  لا تتوفر فئات فرعية أو مقاسات خاصة بهذه السلعة بالكتالوج.
                </div>
              )}
            </div>
          </div>

          {/* Delivery and Returns Report */}
          <DeliveryReturnsReport productId={p.id} />
          
          {/* Ads Spy Matches */}
          <ProductAdsSection productId={p.id} />

          {/* Snapshots Logs timeline */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-extrabold text-[#F4F7FB] flex items-center gap-2">
              <History className="w-4 h-4 text-[#8B5CF6]" />
              التسلسل الزمني للقطات الرصد وحركة التغير
            </h4>
            
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {p.history && p.history.map((snap) => (
                <div 
                  key={snap.id} 
                  className="bg-[#07111F]/40 p-3 rounded-xl flex justify-between items-center text-xs text-[#9FB0C5] border border-[#20324A]/30 hover:border-[#20324A]"
                >
                  <span className="font-mono text-[10.5px]">{formatTimeArabic(snap.checkedAt)}</span>
                  <div className="flex gap-4 items-center font-mono">
                    <span>المخزون: <strong className="text-white">{snap.currentQuantity}</strong></span>
                    {snap.quantityDecrease > 0 && (
                      <span className="text-[#24C78E] font-black flex items-center">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        -{snap.quantityDecrease}
                      </span>
                    )}
                    {snap.restockAmount > 0 && (
                      <span className="text-[#FBBF24] font-black flex items-center">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        +{snap.restockAmount} شحن
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {(!p.history || p.history.length === 0) && (
                <div className="text-center py-6 text-xs text-[#9FB0C5]/60 bg-[#07111F]/20 rounded-xl border border-dashed border-[#20324A]/30">
                  لا تتوفر فترات رصد تاريخية مسجلة لهذه السلعة.
                </div>
              )}
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
