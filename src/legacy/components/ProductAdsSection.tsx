// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Megaphone, ExternalLink, Activity, Info, BarChart3, AlertCircle } from "lucide-react";
import { safeFetchJson } from "../lib/api";

export default function ProductAdsSection({ productId }: { productId: string }) {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    safeFetchJson(`/api/ads-spy/products/${productId}/ads`)
      .then(data => {
        if (Array.isArray(data)) setAds(data.filter(m => m.match_status !== "REJECTED"));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="space-y-3 pt-4 border-t border-[#2a2a5c]/40">
        <h4 className="text-xs font-extrabold text-[#f5f5fa] flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#F5A524]" />
          إعلانات المنافسين (Ads Spy)
        </h4>
        <div className="text-center py-6 text-xs text-[#a5a5c8]/60 bg-[#0a0a1a]/20 rounded-xl border border-dashed border-[#2a2a5c]/30">
          جاري جلب الإعلانات...
        </div>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="space-y-3 pt-4 border-t border-[#2a2a5c]/40">
        <h4 className="text-xs font-extrabold text-[#f5f5fa] flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#F5A524]" />
          إعلانات المنافسين (Ads Spy)
        </h4>
        <div className="text-center py-6 text-xs text-[#a5a5c8]/60 bg-[#0a0a1a]/20 rounded-xl border border-dashed border-[#2a2a5c]/30">
          لا توجد إعلانات مسحوبة لهذا المنتج حتى الآن.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4 border-t border-[#2a2a5c]/40">
      <h4 className="text-xs font-extrabold text-[#f5f5fa] flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-[#F5A524]" />
        إعلانات المنافسين (Ads Spy)
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 scrollbar-none">
        {ads.map((match: any) => {
          const ad = match.ad || {};
          const analysisList = match.analysis || [];
          const analysis = analysisList.length > 0 ? analysisList[0] : null;

          return (
            <div key={match.id} className="bg-[#0a0a1a]/50 border border-[#2a2a5c] rounded-xl p-3 flex flex-col gap-2 hover:border-[#2a2a5c]/80 transition">
              <div className="flex gap-3">
                {ad.image_url ? (
                  <img src={ad.image_url} alt="Ad" className="w-16 h-16 rounded-lg object-cover bg-[#1c1c47] shrink-0 border border-[#2a2a5c]/50" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-[#1c1c47] shrink-0 border border-[#2a2a5c]/50 flex items-center justify-center">
                    <Megaphone className="w-6 h-6 text-[#a5a5c8]/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h5 className="text-[11px] font-bold text-[#f5f5fa] truncate">{ad.advertiser_name || "معلن غير معروف"}</h5>
                  <p className="text-[10px] text-[#a5a5c8] mt-0.5 line-clamp-2">{ad.body_text || ad.headline || "لا يوجد نص للإعلان"}</p>
                </div>
              </div>

              {analysis && (
                <div className="mt-1 bg-[#1c1c47]/50 rounded-lg p-2 border border-[#2a2a5c]/30 text-[9px] text-[#a5a5c8] flex flex-col gap-1">
                  {analysis.hook && (
                    <div className="flex gap-1.5 items-start">
                      <span className="text-[#F5A524] font-bold shrink-0">الخطاف:</span>
                      <span className="text-white line-clamp-1" title={analysis.hook}>{analysis.hook}</span>
                    </div>
                  )}
                  {analysis.marketing_angle && (
                    <div className="flex gap-1.5 items-start">
                      <span className="text-[#6366f1] font-bold shrink-0">الزاوية:</span>
                      <span className="text-white line-clamp-1" title={analysis.marketing_angle}>{analysis.marketing_angle}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-between items-center mt-auto pt-2 border-t border-[#2a2a5c]/40">
                <span className="text-[9px] px-2 py-0.5 bg-[#2a2a5c]/50 rounded text-[#a5a5c8] font-mono">
                  {ad.source_platform || "meta"}
                </span>
                {ad.external_ad_id && ad.source_platform === "meta" && (
                  <a 
                    href={`https://www.facebook.com/ads/library/?id=${ad.external_ad_id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#6366f1] hover:text-[#4090FF] flex items-center gap-1 font-bold"
                  >
                    رؤية الإعلان
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
