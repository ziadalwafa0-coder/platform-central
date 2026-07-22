// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Search, Trash2, ExternalLink, Calendar, Package } from "lucide-react";
import { AdsSpyProduct, AdSpyProductMatch, AdsSpySummary } from "../../ads-spy-types";

export interface AdsHistoryEntry {
  product: AdsSpyProduct;
  matches: AdSpyProductMatch[];
  summary: AdsSpySummary | null;
  fetchedAt: string;
}

interface AdsSpyHistoryTabProps {
  onSelectHistory: (entry: AdsHistoryEntry) => void;
}

export function AdsSpyHistoryTab({ onSelectHistory }: AdsSpyHistoryTabProps) {
  const [history, setHistory] = useState<AdsHistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadHistory();
    // Also listen for changes in case multiple tabs are open
    window.addEventListener("storage", loadHistory);
    return () => window.removeEventListener("storage", loadHistory);
  }, []);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem("ads_spy_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse ads spy history", e);
    }
  };

  const clearHistory = () => {
    if (confirm("هل أنت متأكد من مسح السجل بالكامل؟")) {
      localStorage.removeItem("ads_spy_history");
      setHistory([]);
    }
  };

  const removeEntry = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(h => h.product.id !== productId);
    localStorage.setItem("ads_spy_history", JSON.stringify(updated));
    setHistory(updated);
  };

  const filteredHistory = history.filter(h => 
    h.product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (h.product.sku && h.product.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (history.length === 0) {
    return (
      <div className="bg-[#07111F]/60 border border-[#20324A] rounded-3xl p-12 text-center space-y-3">
        <Package className="w-10 h-10 text-[#9FB0C5] opacity-50 mx-auto" />
        <h3 className="text-white font-bold text-sm">لا يوجد سجل للإعلانات</h3>
        <p className="text-xs text-[#9FB0C5]">سيتم حفظ نتائج الفحص هنا تلقائياً لسهولة الرجوع إليها.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#07111F]/60 p-4 rounded-2xl border border-[#20324A] text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-[#9FB0C5]" />
            <input
              type="text"
              placeholder="ابحث في السجل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0B1424] border border-[#20324A] text-white text-xs rounded-xl pl-4 pr-9 py-2 focus:outline-none focus:border-[#8B5CF6] transition-all w-64"
            />
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all font-bold"
        >
          <Trash2 className="w-3.5 h-3.5" />
          مسح السجل
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredHistory.map((entry) => (
          <div 
            key={entry.product.id}
            onClick={() => onSelectHistory(entry)}
            className="bg-[#07111F]/60 border border-[#20324A] hover:border-[#8B5CF6]/50 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-[#8B5CF6]/10 flex flex-col gap-3 group relative"
          >
            <button 
              onClick={(e) => removeEntry(entry.product.id, e)}
              className="absolute top-3 left-3 p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
              title="حذف من السجل"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            
            <div className="flex items-start gap-3">
              {entry.product.image_url ? (
                <img src={entry.product.image_url} alt={entry.product.name} className="w-12 h-12 rounded-xl object-cover border border-[#20324A]" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#0B1424] border border-[#20324A] flex items-center justify-center">
                  <Package className="w-5 h-5 text-[#9FB0C5]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm truncate pr-6">{entry.product.name}</h4>
                {entry.product.sku && <p className="text-[#9FB0C5] text-[10px] font-mono mt-0.5">SKU: {entry.product.sku}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
              <div className="bg-[#0B1424] rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#9FB0C5]">الإعلانات المحفوظة</span>
                <span className="text-white font-bold text-sm">{entry.matches.length}</span>
              </div>
              <div className="bg-[#0B1424] rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#9FB0C5]">تاريخ الفحص</span>
                <span className="text-white font-bold text-xs" dir="ltr">
                  {new Date(entry.fetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function saveToAdsSpyHistory(entry: AdsHistoryEntry) {
  try {
    const stored = localStorage.getItem("ads_spy_history");
    let history: AdsHistoryEntry[] = stored ? JSON.parse(stored) : [];
    
    // Remove if already exists to move it to the top
    history = history.filter(h => h.product.id !== entry.product.id);
    
    // Add to beginning
    history.unshift(entry);
    
    // Limit to recent 50
    if (history.length > 50) history = history.slice(0, 50);
    
    localStorage.setItem("ads_spy_history", JSON.stringify(history));
    // Dispatch event so other tabs/components update
    window.dispatchEvent(new Event("storage"));
  } catch (e) {
    console.error("Failed to save to ads spy history", e);
  }
}
