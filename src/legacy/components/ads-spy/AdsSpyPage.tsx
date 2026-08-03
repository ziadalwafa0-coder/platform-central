// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  ScanSearch, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Play, 
  ExternalLink, 
  Compass, 
  Layers, 
  Flag,
  Sparkles,
  Info,
  SlidersHorizontal,
  LayoutGrid,
  Table,
  Plus,
  Trash2,
  Calendar,
  Lock,
  Eye,
  Check,
  Ban,
  ShieldAlert,
  BarChart3,
  Target,
  Clock3,
  FileText,
  Users,
  BrainCircuit,
  Activity,
  Image as ImageIcon,
  Video
} from "lucide-react";
import { AdsSpyProduct, AdSpySearchProfile, AdSpyJob, AdSpyProductMatch, AdsSpySummary, AdsSpyBreakdownItem } from "../../ads-spy-types";
import { adsSpyApi } from "../../lib/adsSpyApi";
import { safeFetchJson } from "../../lib/api";
import { AdsSpyHistoryTab, saveToAdsSpyHistory } from "./AdsSpyHistoryTab";
import { History } from "lucide-react";

const unavailable = "غير متوفر";

function formatArabicDate(value?: string | null) {
  if (!value) return unavailable;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return unavailable;
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function runningDays(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000)) : null;
}

function adContentType(match: AdSpyProductMatch) {
  if (match.analysis?.content_type) return match.analysis.content_type;
  if (match.ad?.video_url) return "فيديو";
  if (match.ad?.image_url) return "صورة";
  return unavailable;
}

function BreakdownList({ items, emptyLabel = "لا توجد بيانات كافية" }: { items?: AdsSpyBreakdownItem[]; emptyLabel?: string }) {
  if (!items?.length) return <p className="text-[10px] text-[#73849A] py-6 text-center">{emptyLabel}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-[10.5px]">
            <span className="text-gray-200 font-bold truncate">{item.label}</span>
            <span className="font-mono text-[#A78BFA] shrink-0">{item.count} · {item.percentage}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-[#1c1c47]">
            <div className="h-full rounded-full bg-gradient-to-l from-[#8B5CF6] to-cyan-400" style={{ width: `${Math.max(3, item.percentage)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface AdsSpyPageProps {
  products: AdsSpyProduct[];
  initialProductId?: string | null;
  onOpenBaseProduct?: (productId: string) => void;
}

export default function AdsSpyPage({
  products,
  initialProductId = null,
  onOpenBaseProduct
}: AdsSpyPageProps) {
  // State variables
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [profile, setProfile] = useState<AdSpySearchProfile | null>(null);
  const [jobs, setJobs] = useState<AdSpyJob[]>([]);
  const [matches, setMatches] = useState<AdSpyProductMatch[]>([]);
  const [pendingMatches, setPendingMatches] = useState<AdSpyProductMatch[] | null>(null);
  const [pendingSummary, setPendingSummary] = useState<AdsSpySummary | null>(null);
  const currentMatchesLengthRef = useRef<number>(0);
  const [withdrawalsMap, setWithdrawalsMap] = useState<Record<string, number>>({});

  useEffect(() => {
    currentMatchesLengthRef.current = matches.length;
  }, [matches]);

  useEffect(() => {
    // Fetch withdrawal activity to sort the products list by highest withdrawals
    safeFetchJson<any>('/api/products/withdrawal-activity?limit=5000').then(data => {
      if (data.success && data.products) {
        const map: Record<string, number> = {};
        data.products.forEach((p: any) => {
          map[p.id] = p.withdrawnPieces || 0;
          if (p.id) {
            // Also store by simplified ID if available
            map[String(p.id)] = p.withdrawnPieces || 0;
          }
        });
        setWithdrawalsMap(map);
      }
    }).catch((err) => {
      console.error("Failed to load withdrawal activity data:", err);
    });
  }, []);

  const sortedProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    
    // Sort all products by withdrawal activity (or fallback activity)
    const getCount = (p: AdsSpyProduct) => {
      return withdrawalsMap[p.id] ?? (p as any).withdrawalCount ?? (p as any).quantity_decrease ?? 0;
    };

    const withWithdrawals = products.filter(p => getCount(p) > 0);
    const listToDisplay = withWithdrawals.length > 0 ? withWithdrawals : products;

    return [...listToDisplay].sort((a, b) => getCount(b) - getCount(a));
  }, [products, withdrawalsMap]);

  const [summary, setSummary] = useState<AdsSpySummary | null>(null);
  const [activeTab, setActiveTab] = useState<"ads" | "profile" | "jobs" | "summary" | "history">("ads");
  
  // Filtering & view modes
  const [platformFilter, setPlatformFilter] = useState<"all" | "meta" | "tiktok">("all");
  const [matchStatusFilter, setMatchStatusFilter] = useState<"all" | "approved" | "needs_review" | "rejected">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [skuQuery, setSkuQuery] = useState<string>("");
  const [isSearchingSku, setIsSearchingSku] = useState(false);
  const [selectedMatchForAnalysis, setSelectedMatchForAnalysis] = useState<AdSpyProductMatch | null>(null);
  const [selectedCoverageReport, setSelectedCoverageReport] = useState<any | null>(null);

  // Profile Form state
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState<string>("");
  const [countries, setCountries] = useState<string[]>(["EG"]);
  const [providers, setProviders] = useState<("meta" | "tiktok")[]>(["meta"]);
  const [maxResults, setMaxResults] = useState<number>(30);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [expandedJobLogs, setExpandedJobLogs] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<Record<string, import("../../ads-spy-types").AdSpyRunLog[]>>({});

  // Status/Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Set initial product
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [initialProductId, products]);

  // Load data for the selected product
  useEffect(() => {
    if (!selectedProductId) return;
    loadProductData(selectedProductId);
    
    // Setup polling for active jobs
    const interval = setInterval(() => {
      loadLiveUpdates();
    }, 8000);

    return () => clearInterval(interval);
  }, [selectedProductId]);

  const loadLiveUpdates = async () => {
    if (!selectedProductId) return;
    try {
      setJobs(await adsSpyApi.getJobs(selectedProductId));
      
      const newMatches = await adsSpyApi.getProductAds(selectedProductId);
      const newSummary = await adsSpyApi.getProductSummary(selectedProductId);
      
      if (newMatches.length > currentMatchesLengthRef.current) {
        setPendingMatches(newMatches);
        setPendingSummary(newSummary);
      } else {
        setMatches(newMatches);
        setSummary(newSummary);
        setPendingMatches(null);
        setPendingSummary(null);
      }
    } catch (err) {}
  };

  const loadProductData = async (productId: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch Profile
      const prof = await adsSpyApi.getSearchProfile(productId);
      setProfile(prof);
      if (prof && prof.keywords && prof.keywords.length > 0) {
        setKeywords(prof.keywords);
        setCountries(prof.country_codes || ["EG"]);
        setProviders(prof.providers || ["meta"]);
        setMaxResults(prof.max_results_per_query || 30);
      } else {
        // Automatically generate high-quality keywords consistent with the product and save the profile
        try {
          const plan = await adsSpyApi.getKeywordPlan(productId);
          const generated = [...plan.tier1, ...plan.tier2, ...plan.tier3, ...plan.tier4, ...plan.tier5]
            .map(keyword => keyword.trim())
            .filter((keyword, index, all) => keyword && all.findIndex(candidate => candidate.toLocaleLowerCase("ar-EG") === keyword.toLocaleLowerCase("ar-EG")) === index)
            .slice(0, 12);
          
          const finalKeywords = generated.length > 0 ? generated : [products.find(p => p.id === productId)?.name || "منتج"];
          setKeywords(finalKeywords);
          setCountries(prof?.country_codes || ["EG"]);
          setProviders(prof?.providers || ["meta"]);
          setMaxResults(prof?.max_results_per_query || 30);

          // Auto-save the search profile with these keywords!
          const saved = await adsSpyApi.saveSearchProfile(productId, {
            keywords: finalKeywords,
            country_codes: prof?.country_codes || ["EG"],
            providers: prof?.providers || ["meta"],
            max_results_per_query: prof?.max_results_per_query || 30,
            is_active: true
          });
          setProfile(saved);
        } catch (planErr) {
          const fallbackKeywords = [products.find(p => p.id === productId)?.name || "منتج"];
          setKeywords(fallbackKeywords);
          setCountries(prof?.country_codes || ["EG"]);
          setProviders(prof?.providers || ["meta"]);
          setMaxResults(prof?.max_results_per_query || 30);

          try {
            const saved = await adsSpyApi.saveSearchProfile(productId, {
              keywords: fallbackKeywords,
              country_codes: prof?.country_codes || ["EG"],
              providers: prof?.providers || ["meta"],
              max_results_per_query: prof?.max_results_per_query || 30,
              is_active: true
            });
            setProfile(saved);
          } catch (saveErr) {}
        }
      }

      // 2. Fetch Jobs
      setJobs(await adsSpyApi.getJobs(productId));

      // 3. Fetch Matches
      const matchedAds = await adsSpyApi.getProductAds(productId);
      setMatches(matchedAds);

      let finalSummary = null;
      // 4. Fetch Summary
      try {
        const summ = await adsSpyApi.getProductSummary(productId);
        setSummary(summ);
        finalSummary = summ;
      } catch (e) {
        // Safe fallback summary
        calculateLocalSummary(matchedAds);
      }
      
      // Save to history
      const foundProduct = products.find(p => p.id === productId);
      if (foundProduct) {
        saveToAdsSpyHistory({
          product: foundProduct,
          matches: matchedAds,
          summary: finalSummary,
          fetchedAt: new Date().toISOString()
        });
      }

    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء تحميل بيانات رادار الإعلانات للمنتج");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateLocalSummary = (matchedAds: AdSpyProductMatch[]) => {
    const included = matchedAds.filter(m => m.match_status !== "REJECTED" && m.ad);
    const metaCount = matchedAds.filter(m => m.ad?.source_platform === "meta").length;
    const tiktokCount = matchedAds.filter(m => m.ad?.source_platform === "tiktok").length;
    const uniqueAdvertisers = new Set(matchedAds.map(m => m.ad?.advertiser_name).filter(Boolean)).size;
    const approved = matchedAds.filter(m => m.match_status === "APPROVED").length;
    const pending = matchedAds.filter(m => m.match_status === "NEEDS_REVIEW").length;

    // Phase 1: Extract real hooks, angles, and offers from real analysis models if present
    const realHooks = matchedAds.map(m => m.analysis?.hook).filter(Boolean) as string[];
    const realAngles = matchedAds.map(m => m.analysis?.marketing_angle).filter(Boolean) as string[];
    const realOffers = matchedAds.map(m => m.analysis?.offer).filter(Boolean) as string[];
    const analyzed = included.filter(m => m.analysis);
    const toBreakdown = (values: Array<string | undefined>): AdsSpyBreakdownItem[] => {
      const clean = values.filter((value): value is string => Boolean(value && value !== unavailable));
      const counts = new Map<string, number>();
      clean.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({
        label, count, percentage: clean.length ? Math.round(count / clean.length * 100) : 0
      }));
    };

    setSummary({
      discovered_ads: matchedAds.length,
      matched_ads: approved,
      needs_review: pending,
      active_ads: matchedAds.filter(m => m.ad?.is_active).length,
      unique_advertisers: uniqueAdvertisers,
      meta_count: metaCount,
      tiktok_count: tiktokCount,
      image_video_ratio: matchedAds.length ? Math.round(matchedAds.filter(m => m.ad?.image_url && !m.ad?.video_url).length / matchedAds.length * 100) : 0,
      median_running_duration_days: 0,
      new_ads_7_days: matchedAds.filter(m => {
        if (!m.created_at) return false;
        const diff = Date.now() - new Date(m.created_at).getTime();
        return diff < 7 * 24 * 60 * 60 * 1000;
      }).length,
      new_ads_30_days: matchedAds.filter(m => {
        if (!m.created_at) return false;
        const diff = Date.now() - new Date(m.created_at).getTime();
        return diff < 30 * 24 * 60 * 60 * 1000;
      }).length,
      top_hooks: realHooks,
      top_angles: realAngles,
      top_offers: realOffers,
      repeated_creatives_count: 0,
      saturation_score: 0,
      creative_opportunity_score: 0,
      analyzed_ads: analyzed.length,
      analysis_coverage: included.length ? Math.round(analyzed.length / included.length * 100) : 0,
      cta_breakdown: toBreakdown(included.map(m => m.ad?.cta_label || m.analysis?.cta)),
      content_type_breakdown: toBreakdown(included.map(adContentType)),
      objective_breakdown: toBreakdown(included.map(m => m.analysis?.objective)),
      platform_breakdown: toBreakdown(included.map(m => m.ad?.source_platform === "meta" ? "Meta" : m.ad?.source_platform === "tiktok" ? "TikTok" : undefined)),
      advertiser_breakdown: toBreakdown(included.map(m => m.ad?.advertiser_name)),
      top_creative_styles: included.map(m => m.analysis?.creative_style).filter(Boolean) as string[],
      top_pain_points: included.flatMap(m => m.analysis?.pain_points || []),
      opportunity_gaps: [],
      product_recommendations: included.flatMap(m => m.analysis?.differentiation_opportunities || []).slice(0, 5),
      latest_ad_seen_at: included.map(m => m.ad?.published_at).filter(Boolean).sort().at(-1) || null
    });
  };

  // Add keyword
  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    if (!keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
    }
    setNewKeyword("");
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleGenerateKeywords = async () => {
    if (!selectedProductId) return;
    setIsGeneratingKeywords(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const plan = await adsSpyApi.getKeywordPlan(selectedProductId);
      const generated = [...plan.tier1, ...plan.tier2, ...plan.tier3, ...plan.tier4, ...plan.tier5]
        .map(keyword => keyword.trim())
        .filter((keyword, index, all) => keyword && all.findIndex(candidate => candidate.toLocaleLowerCase("ar-EG") === keyword.toLocaleLowerCase("ar-EG")) === index)
        .slice(0, 12);
      setKeywords(generated);
      setSuccessMsg(`تم توليد ${generated.length} كلمة بحث متدرجة من بيانات المنتج الحقيقية`);
    } catch (err: any) {
      setErrorMsg(err.message || "تعذر توليد خطة الكلمات المفتاحية");
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const handleSkuSearch = async () => {
    const requestedSku = skuQuery.trim();
    if (!requestedSku) {
      setErrorMsg("اكتب SKU كامل للمنتج أولاً");
      return;
    }
    setIsSearchingSku(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await adsSpyApi.getAdsBySku(requestedSku);
      const exactProduct = products.find(product =>
        product.sku?.trim().toLocaleLowerCase("en-US") === requestedSku.toLocaleLowerCase("en-US")
      );
      const productId = exactProduct?.id || result.product.id;
      setSelectedProductId(productId);
      setMatches(result.ads);
      setSummary(result.summary);
      setActiveTab("ads");
      setSuccessMsg(`تم عرض إعلانات SKU ${requestedSku} فقط`);
      
      saveToAdsSpyHistory({
        product: result.product,
        matches: result.ads,
        summary: result.summary,
        fetchedAt: new Date().toISOString()
      });
    } catch (err: any) {
      setErrorMsg(err.message || "لا يوجد منتج مطابق تماماً لهذا الـ SKU");
    } finally {
      setIsSearchingSku(false);
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!selectedProductId) return;
    setIsSavingProfile(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      let activeKeywords = [...keywords];
      if (activeKeywords.length === 0) {
        try {
          const plan = await adsSpyApi.getKeywordPlan(selectedProductId);
          const generated = [...plan.tier1, ...plan.tier2, ...plan.tier3, ...plan.tier4, ...plan.tier5]
            .map(keyword => keyword.trim())
            .filter((keyword, index, all) => keyword && all.findIndex(candidate => candidate.toLocaleLowerCase("ar-EG") === keyword.toLocaleLowerCase("ar-EG")) === index)
            .slice(0, 12);
          activeKeywords = generated.length > 0 ? generated : [products.find(p => p.id === selectedProductId)?.name || "منتج"];
          setKeywords(activeKeywords);
        } catch (planErr) {
          activeKeywords = [products.find(p => p.id === selectedProductId)?.name || "منتج"];
          setKeywords(activeKeywords);
        }
      }

      const saved = await adsSpyApi.saveSearchProfile(selectedProductId, {
        keywords: activeKeywords,
        country_codes: countries,
        providers,
        max_results_per_query: maxResults,
        is_active: true
      });
      setProfile(saved);
      setSuccessMsg("تم حفظ ملف الفحص والكلمات المفتاحية بنجاح 🎯");
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء حفظ الملف");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Trigger search job
  const handleTriggerScraper = async () => {
    if (!selectedProductId) return;
    setIsStartingJob(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      let activeKeywords = [...keywords];
      if (activeKeywords.length === 0) {
        try {
          const plan = await adsSpyApi.getKeywordPlan(selectedProductId);
          const generated = [...plan.tier1, ...plan.tier2, ...plan.tier3, ...plan.tier4, ...plan.tier5]
            .map(keyword => keyword.trim())
            .filter((keyword, index, all) => keyword && all.findIndex(candidate => candidate.toLocaleLowerCase("ar-EG") === keyword.toLocaleLowerCase("ar-EG")) === index)
            .slice(0, 12);
          activeKeywords = generated.length > 0 ? generated : [products.find(p => p.id === selectedProductId)?.name || "منتج"];
          setKeywords(activeKeywords);
        } catch (planErr) {
          activeKeywords = [products.find(p => p.id === selectedProductId)?.name || "منتج"];
          setKeywords(activeKeywords);
        }
      }

      // Create search profile first if not saved
      const saved = await adsSpyApi.saveSearchProfile(selectedProductId, {
        keywords: activeKeywords,
        country_codes: countries,
        providers,
        max_results_per_query: maxResults,
        is_active: true
      });
      setProfile(saved);

      const job = await adsSpyApi.createJob({
        product_id: selectedProductId,
        providers,
        country_codes: countries,
        keywords: activeKeywords,
        max_results_per_query: maxResults
      });
      setJobs([job, ...jobs]);
      setActiveTab("jobs");
      setSuccessMsg("تم إطلاق الفحص المباشر للمكتبات العامة بالكلمات الخاصة بهذا المنتج 🚀");
    } catch (err: any) {
      setErrorMsg(err.message || "عفواً، فشل إطلاق مهمة الفحص الفوري");
    } finally {
      setIsStartingJob(false);
    }
  };

  // Cancel Job
  const handleToggleLogs = async (jobId: string) => {
    if (expandedJobLogs === jobId) {
      setExpandedJobLogs(null);
      return;
    }
    setExpandedJobLogs(jobId);
    if (!jobLogs[jobId]) {
      try {
        const res = await adsSpyApi.getJobLogs(jobId);
        if (res.success) {
          setJobLogs(prev => ({ ...prev, [jobId]: res.logs }));
        }
      } catch (err) {
        console.error("Failed to load job logs", err);
      }
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await adsSpyApi.cancelJob(jobId);
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: "CANCELLED" as const } : j));
      setSuccessMsg("تم إرسال إشارة إلغاء المهمة بنجاح");
    } catch (err: any) {
      setErrorMsg(err.message || "فشل إلغاء المهمة");
    }
  };

  // Change decision on matches
  const handleApproveMatch = async (matchId: string) => {
    try {
      await adsSpyApi.approveMatch(matchId);
      setMatches(matches.map(m => m.id === matchId ? { ...m, match_status: "APPROVED" as const, user_decision: "APPROVED" as const } : m));
      setSuccessMsg("تم تأكيد وتوثيق مطابقة الإعلان بنجاح!");
    } catch (err: any) {
      setErrorMsg(err.message || "فشل تسجيل الموافقة");
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    try {
      await adsSpyApi.rejectMatch(matchId);
      setMatches(matches.map(m => m.id === matchId ? { ...m, match_status: "REJECTED" as const, user_decision: "REJECTED" as const } : m));
      setSuccessMsg("تم استبعاد الإعلان بنجاح من التحليلات وقائمة المطابقة.");
    } catch (err: any) {
      setErrorMsg(err.message || "فشل تسجيل الاستبعاد");
    }
  };

  // Helper filters
  const currentProduct = products.find(p => p.id === selectedProductId);

  const latestJob = jobs[0];
  const fetchedState = latestJob 
    ? (["PROCESSING", "PENDING"].includes(latestJob.status) ? "pending" : (["EMPTY", "FAILED", "BLOCKED"].includes(latestJob.status) ? "empty" : "active"))
    : null;

  const filteredMatches = matches.filter((match) => {
    if (
      platformFilter !== "all" &&
      match.ad?.source_platform !== platformFilter
    ) {
      return false;
    }

    // Hide unrelated/rejected ads by default
    if (matchStatusFilter === "all" && match.match_status === "REJECTED") {
      return false;
    }

    if (matchStatusFilter !== "all") {
      const matchStatus = match.match_status.toUpperCase();
      if (matchStatusFilter === "approved" && matchStatus !== "APPROVED") {
        return false;
      }
      if (matchStatusFilter === "needs_review" && matchStatus !== "NEEDS_REVIEW") {
        return false;
      }
      if (matchStatusFilter === "rejected" && matchStatus !== "REJECTED") {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      const text = (match.ad?.body_text || "").toLowerCase();
      const headline = (match.ad?.headline || "").toLowerCase();
      const advertiser = (
        match.ad?.advertiser_name || ""
      ).toLowerCase();

      if (
        !text.includes(query) &&
        !headline.includes(query) &&
        !advertiser.includes(query)
      ) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-5 text-right font-sans pb-8" dir="rtl">
      {/* Top Banner and Product selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-l from-[#0D1626] to-[#0A111F] p-4.5 rounded-3xl border border-[#2a2a5c] shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-[#8B5CF6]/10 rounded-xl border border-[#8B5CF6]/30 shadow-[0_0_15px_rgba(139,92,246,0.15)] shrink-0">
            <ScanSearch className="w-5.5 h-5.5 text-[#A78BFA]" />
          </div>
          {currentProduct?.image_url && (
            <img src={currentProduct.image_url} alt="" className="w-11 h-11 object-cover rounded-xl border border-[#2a2a5c] bg-[#0B1626]" referrerPolicy="no-referrer" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-black text-white flex items-center gap-2">
                <span className="truncate">إعلانات المنتج: {currentProduct?.name || "اختر منتجاً"}</span>
              </h1>
              {fetchedState === "pending" && <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-[10px] flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> قيد الفحص (Pending)</span>}
              {fetchedState === "active" && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] flex items-center gap-1"><CheckCircle className="w-3 h-3" /> بيانات نشطة (Active)</span>}
              {fetchedState === "empty" && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] flex items-center gap-1"><Ban className="w-3 h-3" /> فارغ/فشل (Empty)</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[9.5px] text-[#a5a5c8]">
              {currentProduct?.sku && <span className="font-mono bg-[#1c1c47] px-2 py-0.5 rounded">SKU: {currentProduct.sku}</span>}
              {currentProduct?.category && <span>{currentProduct.category}</span>}
              <span className="text-emerald-400 flex items-center gap-1"><Activity className="w-3 h-3" /> بيانات حقيقية + تحليل موضح الثقة</span>
            </div>
          </div>
        </div>

        {/* Exact SKU Search + Product Dropdown Selector */}
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <form
            onSubmit={(event) => { event.preventDefault(); void handleSkuSearch(); }}
            className="flex items-center gap-2 bg-[#1c1c47]/60 p-1 rounded-xl border border-[#8B5CF6]/35"
          >
            <input
              value={skuQuery}
              onChange={(event) => setSkuQuery(event.target.value)}
              placeholder="بحث مطابق بالـ SKU"
              aria-label="بحث مطابق بالـ SKU"
              className="min-w-0 flex-1 md:w-[190px] bg-[#0B1626] border border-[#2a2a5c]/80 text-[11px] font-mono text-[#f5f5fa] rounded-lg px-3 py-2 focus:outline-none focus:border-[#8B5CF6]"
            />
            <button
              type="submit"
              disabled={isSearchingSku || !skuQuery.trim()}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white rounded-lg px-3 py-2 text-[10.5px] font-black flex items-center gap-1.5"
            >
              {isSearchingSku ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              عرض SKU فقط
            </button>
          </form>
        </div>
      </div>
      
              {/* Horizontal Products List */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-white font-black text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            المنتجات النشطة إعلانياً (حسب السحوبات)
          </h2>
          <button
            onClick={async () => {
              setIsStartingJob(true);
              try {
                await safeFetchJson("/api/ads-spy/bulk-trigger", { method: "POST" });
                setSuccessMsg("تم بدء فحص وتحديث الإعلانات للمنتجات الأكثر سحباً في الخلفية!");
              } catch(e) {
                setErrorMsg("فشل إطلاق الفحص الشامل");
              } finally {
                setIsStartingJob(false);
              }
            }}
            disabled={isStartingJob}
            className="bg-[#6366f1]/20 text-[#6366f1] hover:bg-[#6366f1] hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-[#6366f1]/30 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isStartingJob ? "animate-spin" : ""}`} />
            تحديث شامل للمنتجات
          </button>
        </div>
      <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
        {sortedProducts.map((p, index) => {
          const wCount = withdrawalsMap[p.id] || 0;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              className={`snap-start shrink-0 flex flex-col gap-2 items-center justify-start p-3 rounded-2xl border transition-all min-w-[140px] max-w-[140px] h-[160px] relative overflow-hidden group
                ${selectedProductId === p.id ? "bg-[#8B5CF6]/15 border-[#8B5CF6] text-white shadow-[0_0_20px_rgba(139,92,246,0.15)]" : "bg-[#0f0f24]/80 border-[#2a2a5c]/60 text-gray-400 hover:border-[#8B5CF6]/50 hover:bg-[#1c1c47]"}
              `}
            >
              <div className="absolute top-0 right-0 bg-[#0a0a1a]/80 text-[#a5a5c8] text-[9px] px-2 py-0.5 rounded-bl-lg border-b border-l border-[#2a2a5c] font-mono font-bold z-10">
                #{index + 1}
              </div>
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#1c1c47] shrink-0 border border-[#2a2a5c] group-hover:border-[#8B5CF6]/30 transition-colors">
                 {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ScanSearch className="w-5 h-5 text-gray-500/50"/></div>}
              </div>
              <span className="text-[10px] text-center font-bold line-clamp-2 w-full leading-relaxed mt-auto" title={p.name}>{p.name}</span>
              <div className="flex items-center gap-1.5 mt-auto bg-[#0a0a1a]/50 w-full justify-center py-1.5 rounded-lg border border-[#2a2a5c]/30">
                 <Activity className={`w-3 h-3 ${wCount > 0 ? "text-emerald-400" : "text-gray-500"}`} />
                 <span className={`font-mono font-bold text-[9px] ${wCount > 0 ? "text-emerald-400" : "text-gray-500"}`}>{wCount} سحب</span>
              </div>
            </button>
          );
        })}
      </div>
      {sortedProducts.length === 0 && (
        <div className="text-center text-[11px] text-[#a5a5c8] bg-[#0f0f24]/60 border border-[#2a2a5c]/60 rounded-2xl py-6">
          لا توجد منتجات عليها سحوبات فعلية خلال آخر 7 أيام
        </div>
      )}
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-2xl text-xs flex items-center gap-2.5 justify-start">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-2xl text-xs flex items-center gap-2.5 justify-start">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

            {/* TWO-COLUMN DASHBOARD SPLIT GRID */}
      {pendingMatches && pendingMatches.length > matches.length && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <button 
            onClick={() => {
              setMatches(pendingMatches);
              if (pendingSummary) setSummary(pendingSummary);
              setPendingMatches(null);
              setPendingSummary(null);
            }}
            className="bg-[#6366f1] text-white px-5 py-2.5 rounded-full shadow-xl shadow-[#6366f1]/30 flex items-center gap-2 font-bold animate-bounce cursor-pointer border border-[#6366f1]/50"
          >
            <RefreshCw className="w-4 h-4" />
            يوجد {pendingMatches.length - matches.length} إعلانات جديدة، اضغط لتحديث القائمة
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: DENSE METRICS & SCRAPER QUICK CONTROLS (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          {summary && (
            <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-4.5 space-y-3 shadow-lg">
              <div className="border-b border-[#2a2a5c]/50 pb-2.5">
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  أداء ومؤشرات الرادار الفورية
                </h3>
              </div>

              {/* Stacked list of metrics */}
              <div className="space-y-2.5 text-xs">
                {/* Metric 1 */}
                <div className="flex items-center justify-between p-2.5 bg-[#0f0f24]/60 border border-[#2a2a5c]/60 rounded-xl">
                  <span className="text-[#a5a5c8] font-bold">إجمالي الإعلانات المكتشفة</span>
                  <span className="font-mono text-white font-black text-sm bg-[#1c1c47] px-2 py-0.5 rounded border border-[#2a2a5c]">{summary.discovered_ads}</span>
                </div>

                {/* Metric 2 */}
                <div className="flex items-center justify-between p-2.5 bg-[#0f0f24]/60 border border-emerald-500/15 rounded-xl">
                  <span className="text-emerald-400 font-bold">المطابقات المؤكدة</span>
                  <span className="font-mono text-emerald-400 font-black text-sm bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{summary.matched_ads}</span>
                </div>

                {/* Metric 3 */}
                <div className="flex items-center justify-between p-2.5 bg-[#0f0f24]/60 border border-yellow-500/15 rounded-xl">
                  <span className="text-[#F5A524] font-bold">قيد المراجعة والتدقيق</span>
                  <span className="font-mono text-[#F5A524] font-black text-sm bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">{summary.needs_review}</span>
                </div>

                {/* Metric 4 */}
                <div className="flex items-center justify-between p-2.5 bg-[#0f0f24]/60 border border-purple-500/15 rounded-xl">
                  <span className="text-[#C4B5FD] font-bold">المعلنون المنافسون النشطون</span>
                  <span className="font-mono text-[#C4B5FD] font-black text-sm bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{summary.unique_advertisers}</span>
                </div>

                <div className="p-2.5 bg-[#0f0f24]/60 border border-cyan-500/15 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-bold flex items-center gap-1.5"><BrainCircuit className="w-3.5 h-3.5" /> تغطية التحليل</span>
                    <span className="font-mono text-cyan-300 font-black">{summary.analyzed_ads}/{Math.max(0, summary.discovered_ads - (matches.filter(m => m.match_status === "REJECTED").length))} · {summary.analysis_coverage}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1c1c47] rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${summary.analysis_coverage}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                    <span className="text-[9px] text-[#a5a5c8] block">نشط الآن</span>
                    <strong className="text-emerald-400 font-mono text-base">{summary.active_ads}</strong>
                  </div>
                  <div className="p-2.5 bg-blue-500/5 border border-blue-500/15 rounded-xl">
                    <span className="text-[9px] text-[#a5a5c8] block">جديد خلال 7 أيام</span>
                    <strong className="text-blue-400 font-mono text-base">{summary.new_ads_7_days}</strong>
                  </div>
                </div>

                {/* Metric 5 */}
                <div className="flex items-center justify-between p-2.5 bg-[#0f0f24]/60 border border-[#2a2a5c] rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-gray-300 font-bold block">مؤشر تشبع الإعلان</span>
                    <span className="text-[10px] text-[#a5a5c8]">مدى انتشار السلعة إشهارياً</span>
                  </div>
                  <span className={`font-mono font-black text-xs px-2 py-1 rounded ${summary.saturation_score > 60 ? "text-red-400 bg-red-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
                    {summary.saturation_score}%
                  </span>
                </div>

                {/* Metric 6 */}
                <div className="flex items-center justify-between p-2.5 bg-[#0f0f24]/60 border border-[#2a2a5c]/80 rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-cyan-400 font-bold block">الفرصة الإبداعية</span>
                    <span className="text-[10px] text-[#a5a5c8]">مساحة الابتكار الحر</span>
                  </div>
                  <span className="font-mono text-cyan-400 font-black text-xs bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
                    {summary.creative_opportunity_score}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Launch Card */}
          <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-4.5 space-y-3.5 shadow-lg">
            <h4 className="text-xs font-black text-white">إجراءات المسح والرصد الفوري</h4>
            
            {jobs.some(j => j.status === "PROCESSING" || j.status === "PENDING") ? (
              <div className="bg-cyan-500/5 border border-cyan-500/10 p-3 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    جاري سحب الإعلانات الآن...
                  </span>
                  <span className="font-mono text-[#a5a5c8] font-black">
                    {jobs.find(j => j.status === "PROCESSING" || j.status === "PENDING")?.progress_percentage || 0}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#1c1c47] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 animate-pulse transition-all duration-300"
                    style={{ width: `${jobs.find(j => j.status === "PROCESSING" || j.status === "PENDING")?.progress_percentage || 10}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-[#a5a5c8] leading-relaxed">
                لا توجد عملية رصد نشطة حالياً. يمكنك إطلاق فحص مباشر للمكتبات العامة ثم مراجعة النتائج المرتبطة بهذا المنتج فقط.
              </p>
            )}

            <button
              onClick={handleTriggerScraper}
              disabled={isStartingJob}
              className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isStartingJob ? "animate-spin" : ""}`} />
              {isStartingJob ? "جاري تشغيل scraper..." : "إطلاق فحص إعلاني فوري 🚀"}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: MAIN INTERNALLY SCROLLABLE WORKSPACE (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-[#0a0a1a]/40 border border-[#2a2a5c] rounded-3xl p-5 flex flex-col h-[780px] overflow-hidden shadow-2xl relative">
          
          {/* Tab switches header inside right panel */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[#2a2a5c]/60 pb-3">
            <div className="flex items-center gap-1 bg-[#0A1424] p-1 rounded-xl border border-[#2a2a5c]/60 w-full sm:w-auto overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab("ads")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                  activeTab === "ads"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#a5a5c8] hover:text-white"
                }`}
              >
                إعلانات المنتج ({filteredMatches.length})
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                  activeTab === "profile"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#a5a5c8] hover:text-white"
                }`}
              >
                مصادر البحث
              </button>
              <button
                onClick={() => setActiveTab("jobs")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                  activeTab === "jobs"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#a5a5c8] hover:text-white"
                }`}
              >
                سجل الفحص ({jobs.length})
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                  activeTab === "summary"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#a5a5c8] hover:text-white"
                }`}
              >
                لوحة التحليل
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  activeTab === "history"
                    ? "bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/25"
                    : "text-[#a5a5c8] hover:text-white"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                سجل الفحص
              </button>
            </div>
            
            <div className="hidden sm:block text-[10px] text-[#a5a5c8] font-black font-mono">
              كل إعلان مرتبط بالمنتج المحدد
            </div>
          </div>

          {/* Internally Scrollable content container */}
          <div className="flex-1 overflow-y-auto mt-4 pr-1 scrollbar-thin scrollbar-thumb-[#2a2a5c] scrollbar-track-transparent">
            {isLoading ? (
              <div className="py-24 text-center space-y-4">
                <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin mx-auto" />
                <p className="text-xs text-[#a5a5c8] font-black">جاري سحب وتصنيف بيانات الرادار...</p>
              </div>
            ) : (
              <>
          {/* TAB 1: ADS FILTERED GRID */}
          {activeTab === "ads" && (
            <div className="space-y-4">
              {/* Filters Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0a1a]/60 p-4 rounded-2xl border border-[#2a2a5c] text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-2.5 w-3.5 h-3.5 text-[#a5a5c8]" />
                    <input
                      type="text"
                      placeholder="ابحث في نص الإعلان أو المعلن..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-[#0f0f24] border border-[#2a2a5c] rounded-xl pr-9 pl-3 py-2 w-[220px] focus:outline-none focus:border-[#8B5CF6] text-white text-xs font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[#a5a5c8]">المنصة:</span>
                    <select
                      value={platformFilter}
                      onChange={(e) => setPlatformFilter(e.target.value as any)}
                      className="bg-[#0f0f24] border border-[#2a2a5c] rounded-xl px-2.5 py-1.5 font-semibold text-white focus:outline-none text-xs"
                    >
                      <option value="all">كل الشبكات</option>
                      <option value="meta">فيس بوك وانستغرام (Meta)</option>
                      <option value="tiktok">تيك توك (TikTok)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[#a5a5c8]">حالة المراجعة:</span>
                    <select
                      value={matchStatusFilter}
                      onChange={(e) => setMatchStatusFilter(e.target.value as any)}
                      className="bg-[#0f0f24] border border-[#2a2a5c] rounded-xl px-2.5 py-1.5 font-semibold text-white focus:outline-none text-xs"
                    >
                      <option value="all">كل الحالات</option>
                      <option value="needs_review">مراجعة مطلوبة (NEEDS_REVIEW)</option>
                      <option value="approved">مطابقة مؤكدة تلقائياً (APPROVED)</option>
                      <option value="rejected">مستبعد (REJECTED)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-[#141432] p-1 rounded-xl border border-[#2a2a5c]">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-[#8B5CF6] text-white" : "text-[#a5a5c8] hover:text-white"}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === "table" ? "bg-[#8B5CF6] text-white" : "text-[#a5a5c8] hover:text-white"}`}
                  >
                    <Table className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Grid or Table list */}
              {filteredMatches.length === 0 ? (
                <div className="bg-[#0a0a1a]/30 border border-[#2a2a5c]/40 rounded-3xl p-16 text-center space-y-3">
                  <Compass className="w-12 h-12 text-[#a5a5c8] opacity-50 mx-auto" />
                  <h3 className="text-sm font-black text-white">لا توجد إعلانات مطابقة متوفرة</h3>
                  <p className="text-[11px] text-[#a5a5c8] max-w-[360px] mx-auto leading-relaxed">
                    لم نكتشف إعلانات مطابقة حتى الآن لهذا المنتج. تأكد من تهيئة كلماتك المفتاحية وإطلاق فحص scraper.
                  </p>
                </div>
              ) : viewMode === "grid" ? (
                /* BENTO ADS GRID */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredMatches.map((m) => {
                    const ad = m.ad;
                    if (!ad) return null;

                    // Safely parse evidence
                    let evidenceObj: any = null;
                    if (m.evidence) {
                      try {
                        evidenceObj = typeof m.evidence === "string" ? JSON.parse(m.evidence) : m.evidence;
                      } catch (e) {
                        console.error("Failed to parse match evidence", e);
                      }
                    }

                    return (
                      <div 
                        key={m.id}
                        className={`bg-[#0a0a1a]/80 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between overflow-hidden group ${
                          m.match_status === "APPROVED" 
                            ? "border-emerald-500/30 hover:border-emerald-500/50" 
                            : m.match_status === "REJECTED"
                            ? "border-red-500/20 hover:border-red-500/40 opacity-70"
                            : "border-[#2a2a5c] hover:border-[#8B5CF6]/50"
                        }`}
                      >
                        {/* Ad Platform Badge Row */}
                        <div className="p-3.5 border-b border-[#2a2a5c]/40 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded font-black ${
                              ad.source_platform === "meta" 
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                                : "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                            }`}>
                              {ad.source_platform === "meta" ? "فيسبوك Meta" : "تيك توك TikTok"}
                            </span>
                            <span className="text-[#a5a5c8] font-semibold">{ad.advertiser_name}</span>
                          </div>
                          
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            m.match_status === "APPROVED" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : m.match_status === "REJECTED"
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          }`}>
                            {m.match_status === "APPROVED" ? "مطابق مؤكد (APPROVED)" : m.match_status === "REJECTED" ? "مستبعد (REJECTED)" : "مراجعة مطلوبة (NEEDS_REVIEW)"}
                          </span>
                        </div>

                        {/* Ad Body Content */}
                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-[12px] leading-relaxed font-black text-white line-clamp-2">{ad.headline || ad.advertiser_name}</h4>
                              <span className={`text-[9px] px-2 py-1 rounded-lg shrink-0 border ${ad.is_active ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                                {ad.is_active ? "نشط" : "غير نشط"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-[#a5a5c8]">
                              <span className="flex items-center gap-1 bg-[#1c1c47] px-2 py-1 rounded-lg">
                                {ad.video_url ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}{adContentType(m)}
                              </span>
                              <span className="flex items-center gap-1 bg-[#1c1c47] px-2 py-1 rounded-lg"><Clock3 className="w-3 h-3" /> {formatArabicDate(ad.published_at)}</span>
                              <span className="font-mono bg-[#1c1c47] px-2 py-1 rounded-lg">ID: {ad.external_ad_id}</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed font-medium line-clamp-4 text-right">
                            {m.analysis?.caption_summary || ad.body_text || "لا يوجد نص إعلاني متاح من المصدر"}
                          </p>

                          {m.analysis && (
                            <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] text-[#A78BFA] font-black flex items-center gap-1"><Target className="w-3 h-3" /> الهدف المستنتج</span>
                                <span className="text-[9px] font-mono text-[#C4B5FD]">ثقة {m.analysis.analysis_confidence ?? unavailable}{typeof m.analysis.analysis_confidence === "number" ? "%" : ""}</span>
                              </div>
                              <p className="text-[10.5px] text-gray-200 font-bold leading-relaxed">{m.analysis.objective || unavailable}</p>
                              <div className="flex flex-wrap gap-1.5 text-[9px]">
                                {m.analysis.funnel_stage && m.analysis.funnel_stage !== unavailable && <span className="bg-[#1c1c47] px-2 py-0.5 rounded text-cyan-300">{m.analysis.funnel_stage}</span>}
                                {m.analysis.marketing_angle && <span className="bg-[#1c1c47] px-2 py-0.5 rounded text-[#C4B5FD]">{m.analysis.marketing_angle}</span>}
                              </div>
                            </div>
                          )}

                          {/* Ad media mock */}
                          <div className="aspect-video bg-[#0A1424] rounded-xl border border-[#2a2a5c]/60 flex items-center justify-center relative overflow-hidden">
                            {ad.image_url ? (
                              <img src={ad.image_url} alt="" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-[10px] text-gray-500">
                                {ad.video_url ? <Video className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />}
                                <span>{ad.video_url ? "فيديو متاح من صفحة المصدر" : "لا توجد معاينة وسائط متاحة"}</span>
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono text-white">
                              CTA: {ad.cta_label || unavailable}
                            </div>
                          </div>

                          {/* Matching Score Meter */}
                          <div className="bg-[#0B1E36]/30 p-2 rounded-xl border border-[#2a2a5c]/40 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-[#a5a5c8]">نسبة مطابقة المنتج التلقائية:</span>
                              <span className="font-mono text-white font-bold">{m.match_score}%</span>
                            </div>
                            <div className="h-1.5 bg-[#1c1c47] rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  m.match_score > 75 ? "bg-emerald-500" : m.match_score > 50 ? "bg-yellow-500" : "bg-red-500"
                                }`} 
                                style={{ width: `${m.match_score}%` }} 
                              />
                            </div>
                          </div>

                          {/* Matching Evidence Block */}
                          {evidenceObj && (
                            <div className="bg-[#0a0a1a] p-3 rounded-xl border border-[#2a2a5c]/50 space-y-2 mt-2 text-[10px] text-right" dir="rtl">
                              <div className="text-[11px] font-black text-slate-300 border-b border-[#2a2a5c]/30 pb-1 flex items-center gap-1.5 justify-start">
                                <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                                <span>شواهد مطابقة الرادار (Radar Match Evidence)</span>
                              </div>
                              
                              {/* Matched Signals */}
                              {evidenceObj.matchedSignals && evidenceObj.matchedSignals.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-emerald-400 font-bold flex items-center gap-1 justify-start">
                                    <CheckCircle className="w-3 h-3 shrink-0" />
                                    <span>إشارات التوافق المؤكدة:</span>
                                  </div>
                                  <ul className="list-disc list-inside text-[#a5a5c8] space-y-0.5 pr-1.5 text-right">
                                    {evidenceObj.matchedSignals.map((sig: string, idx: number) => (
                                      <li key={idx} className="leading-relaxed list-none relative pr-3 before:content-['•'] before:absolute before:right-0 before:text-emerald-500">{sig}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Conflicting Signals */}
                              {evidenceObj.conflictingSignals && evidenceObj.conflictingSignals.length > 0 && (
                                <div className="space-y-1">
                                  <div className="text-red-400 font-bold flex items-center gap-1 justify-start">
                                    <ShieldAlert className="w-3 h-3 shrink-0" />
                                    <span>التعارضات المكتشفة:</span>
                                  </div>
                                  <ul className="list-disc list-inside text-red-300 space-y-0.5 pr-1.5 text-right">
                                    {evidenceObj.conflictingSignals.map((conf: string, idx: number) => (
                                      <li key={idx} className="leading-relaxed list-none relative pr-3 before:content-['•'] before:absolute before:right-0 before:text-red-400">{conf}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Extracted Entity Details */}
                              {(evidenceObj.extractedProductName || evidenceObj.detectedBrand || evidenceObj.detectedModel || evidenceObj.detectedSku) && (
                                <div className="bg-[#0f0f24]/40 p-2 rounded border border-[#2a2a5c]/40 grid grid-cols-2 gap-1.5 text-[9px] text-[#a5a5c8] font-mono">
                                  {evidenceObj.extractedProductName && (
                                    <div className="truncate">
                                      <span className="text-[#8B5CF6] font-bold">اسم مستنتج:</span> {evidenceObj.extractedProductName}
                                    </div>
                                  )}
                                  {evidenceObj.detectedBrand && (
                                    <div className="truncate">
                                      <span className="text-[#8B5CF6] font-bold">الماركة:</span> {evidenceObj.detectedBrand}
                                    </div>
                                  )}
                                  {evidenceObj.detectedModel && (
                                    <div className="truncate">
                                      <span className="text-[#8B5CF6] font-bold">الموديل:</span> {evidenceObj.detectedModel}
                                    </div>
                                  )}
                                  {evidenceObj.detectedSku && (
                                    <div className="truncate col-span-2">
                                      <span className="text-[#8B5CF6] font-bold">SKU مرصود:</span> {evidenceObj.detectedSku}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Final Reason */}
                              {evidenceObj.finalClassificationReason && (
                                <div className="text-slate-300 leading-normal bg-[#0f0f24]/60 p-2 rounded border border-[#2a2a5c]/30 text-[10px]">
                                  <strong className="text-purple-300 font-bold">مبرر التصنيف:</strong> {evidenceObj.finalClassificationReason}
                                </div>
                              )}

                              {/* Kimi Analysis Block (AI Inference) */}
                              {evidenceObj.aiInference && (
                                <div className="bg-[#050B14] p-3 rounded-xl border border-purple-500/20 space-y-2 mt-2 text-[10px] text-right text-slate-300" dir="rtl">
                                  <div className="text-[11px] font-black text-purple-300 border-b border-purple-500/10 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 justify-start">
                                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                      <span>استدلال الذكاء الاصطناعي - Kimi (AI Inference)</span>
                                    </div>
                                    <span className="text-[8px] bg-purple-950/60 text-purple-400 border border-purple-800/40 px-1 rounded">
                                      {evidenceObj.aiInference.cacheStatus === "HIT" ? "مخزن مؤقتاً (Cache)" : "مباشر (Live)"}
                                    </span>
                                  </div>

                                  {evidenceObj.aiInference.safeErrorCode !== "SUCCESS" ? (
                                    <div className="text-yellow-400 text-[9px] py-0.5 text-center bg-yellow-950/25 rounded border border-yellow-800/20 font-mono">
                                      تعذر إتمام التحليل التلقائي: {evidenceObj.aiInference.safeErrorCode}
                                    </div>
                                  ) : (
                                    <>
                                      {/* Match Assessment Badge */}
                                      <div className="flex items-center justify-between text-[9.5px]">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400 font-bold">تقييم المطابقة:</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-black ${
                                            evidenceObj.aiInference.data.matchAssessment === "EXACT_MATCH"
                                              ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800/30"
                                              : evidenceObj.aiInference.data.matchAssessment === "POSSIBLE_MATCH"
                                                ? "bg-yellow-950/50 text-yellow-400 border border-yellow-800/30"
                                                : "bg-red-950/50 text-red-400 border border-red-800/30"
                                          }`}>
                                            {evidenceObj.aiInference.data.matchAssessment}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                          <span className="text-slate-400 font-bold">نسبة الثقة:</span>
                                          <span className="text-purple-400 font-mono font-bold">{evidenceObj.aiInference.data.confidence}%</span>
                                        </div>
                                      </div>

                                      {/* Reason */}
                                      {evidenceObj.aiInference.data.reason && (
                                        <div className="bg-purple-950/10 p-1.5 rounded border border-purple-500/10 text-[9.5px] leading-relaxed">
                                          <span className="text-purple-300 font-bold">تفسير الـ AI:</span> {evidenceObj.aiInference.data.reason}
                                        </div>
                                      )}

                                      {/* Extracted Entity fields - Labelled as AI Inference */}
                                      <div className="bg-purple-950/10 p-2 rounded border border-purple-500/10 space-y-1">
                                        <div className="text-[9px] font-bold text-purple-300 border-b border-purple-500/5 pb-0.5">الكيانات المستخلصة (استدلال AI غير مؤكد)</div>
                                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8.5px] font-mono">
                                          {evidenceObj.aiInference.data.entity?.productName && (
                                            <div className="truncate"><span className="text-purple-400 font-bold">اسم المنتج:</span> {evidenceObj.aiInference.data.entity.productName}</div>
                                          )}
                                          {evidenceObj.aiInference.data.entity?.brand && (
                                            <div className="truncate"><span className="text-purple-400 font-bold">العلامة:</span> {evidenceObj.aiInference.data.entity.brand}</div>
                                          )}
                                          {evidenceObj.aiInference.data.entity?.model && (
                                            <div className="truncate"><span className="text-purple-400 font-bold">الموديل:</span> {evidenceObj.aiInference.data.entity.model}</div>
                                          )}
                                          {evidenceObj.aiInference.data.entity?.sku && (
                                            <div className="truncate col-span-2"><span className="text-purple-400 font-bold">SKU المستخلص:</span> {evidenceObj.aiInference.data.entity.sku}</div>
                                          )}
                                          {evidenceObj.aiInference.data.entity?.size && (
                                            <div className="truncate"><span className="text-purple-400 font-bold">الحجم:</span> {evidenceObj.aiInference.data.entity.size}</div>
                                          )}
                                          {evidenceObj.aiInference.data.entity?.color && (
                                            <div className="truncate"><span className="text-purple-400 font-bold">اللون:</span> {evidenceObj.aiInference.data.entity.color}</div>
                                          )}
                                          {evidenceObj.aiInference.data.entity?.packCount !== null && (
                                            <div className="truncate"><span className="text-purple-400 font-bold">القطع:</span> {evidenceObj.aiInference.data.entity.packCount}</div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Creative Insights */}
                                      {evidenceObj.aiInference.data.creativeInsights && (
                                        <div className="bg-purple-950/10 p-2 rounded border border-purple-500/10 space-y-1">
                                          <div className="text-[9px] font-bold text-purple-300 border-b border-purple-500/5 pb-0.5">رؤى إبداعية وعروض تسويقية (Creative Insights)</div>
                                          <div className="space-y-1 text-[8.5px] leading-normal">
                                            {evidenceObj.aiInference.data.creativeInsights.hook && (
                                              <div><span className="text-purple-400 font-bold">الخطاف التسويقي (Hook):</span> {evidenceObj.aiInference.data.creativeInsights.hook}</div>
                                            )}
                                            {evidenceObj.aiInference.data.creativeInsights.offer && (
                                              <div><span className="text-purple-400 font-bold">العرض (Offer):</span> {evidenceObj.aiInference.data.creativeInsights.offer}</div>
                                            )}
                                            {evidenceObj.aiInference.data.creativeInsights.cta && (
                                              <div><span className="text-purple-400 font-bold">دعوة العمل (CTA):</span> {evidenceObj.aiInference.data.creativeInsights.cta}</div>
                                            )}
                                            {evidenceObj.aiInference.data.creativeInsights.contentType && (
                                              <div><span className="text-purple-400 font-bold">نوع المحتوى:</span> {evidenceObj.aiInference.data.creativeInsights.contentType}</div>
                                            )}
                                            {evidenceObj.aiInference.data.creativeInsights.targetAudience && (
                                              <div><span className="text-purple-400 font-bold">الجمهور المستهدف:</span> {evidenceObj.aiInference.data.creativeInsights.targetAudience}</div>
                                            )}
                                            {evidenceObj.aiInference.data.creativeInsights.funnelStage && (
                                              <div><span className="text-purple-400 font-bold">مرحلة القمع:</span> {evidenceObj.aiInference.data.creativeInsights.funnelStage}</div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Metadata */}
                                      <div className="text-[8px] text-slate-500 flex items-center justify-between border-t border-purple-500/5 pt-1 font-mono">
                                        <span>النموذج: {evidenceObj.aiInference.model}</span>
                                        <span>زمن الاستجابة: {evidenceObj.aiInference.latency}ms</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons footer */}
                        <div className="p-3 bg-[#0A1424]/80 border-t border-[#2a2a5c]/40 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setSelectedMatchForAnalysis(m)}
                            className="bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 text-[#C4B5FD] border border-[#8B5CF6]/30 px-3 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            تحليلات الـ AI
                          </button>

                          <div className="flex items-center gap-1.5">
                            {ad.ad_url && (
                              <a href={ad.ad_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 p-1.5" title="فتح صفحة الإعلان الأصلية">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {m.match_status !== "APPROVED" && (
                              <button
                                onClick={() => handleApproveMatch(m.id)}
                                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 p-1.5 rounded-lg transition-all"
                                title="تأكيد كإعلان مطابق"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {m.match_status !== "REJECTED" && (
                              <button
                                onClick={() => handleRejectMatch(m.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-1.5 rounded-lg transition-all"
                                title="استبعاد الإعلان"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* DETAILED LIST TABLE VIEW */
                <div className="overflow-x-auto bg-[#0a0a1a]/60 rounded-2xl border border-[#2a2a5c]">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[#2a2a5c] text-[#a5a5c8] font-black">
                        <th className="p-4 text-right">المعلن والمنصة</th>
                        <th className="p-4 text-right">نص الإعلان الإبداعي</th>
                        <th className="p-4 text-center">نوع الإجراء CTA</th>
                        <th className="p-4 text-right">الهدف المستنتج</th>
                        <th className="p-4 text-center">درجة المطابقة</th>
                        <th className="p-4 text-center">الحالة</th>
                        <th className="p-4 text-left">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2a5c]/40 text-white">
                      {filteredMatches.map((m) => {
                        const ad = m.ad;
                        if (!ad) return null;
                        return (
                          <tr key={m.id} className="hover:bg-[#1c1c47]/20 transition-colors">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold">{ad.advertiser_name}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded w-max mt-1 ${
                                  ad.source_platform === "meta" ? "bg-blue-500/10 text-blue-400" : "bg-teal-500/10 text-teal-400"
                                }`}>
                                  {ad.source_platform === "meta" ? "Meta" : "TikTok"}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 max-w-[320px]">
                              <div className="line-clamp-2 text-gray-200 mb-1">{m.analysis?.caption_summary || ad.body_text || "لا يوجد نص متاح"}</div>
                              
                              {/* Inline evidence summary */}
                              {(() => {
                                let evidenceObj: any = null;
                                if (m.evidence) {
                                  try {
                                    evidenceObj = typeof m.evidence === "string" ? JSON.parse(m.evidence) : m.evidence;
                                  } catch (e) {
                                    console.error("Error in ads-spy analysis handling:", e);
                                  }
                                }
                                if (!evidenceObj) return null;
                                return (
                                  <div className="flex flex-col gap-1 mt-1.5 text-[9.5px]">
                                    {evidenceObj.matchedSignals && evidenceObj.matchedSignals.length > 0 && (
                                      <div className="flex items-center gap-1 text-emerald-400 font-semibold justify-start">
                                        <Check className="w-3 h-3 shrink-0" />
                                        <span className="truncate">إشارات: {evidenceObj.matchedSignals.join(" ، ")}</span>
                                      </div>
                                    )}
                                    {evidenceObj.conflictingSignals && evidenceObj.conflictingSignals.length > 0 && (
                                      <div className="flex items-center gap-1 text-red-400 font-semibold justify-start">
                                        <Ban className="w-3 h-3 shrink-0" />
                                        <span className="truncate text-red-300">التعارضات: {evidenceObj.conflictingSignals.join(" ، ")}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-4 text-center font-mono">{ad.cta_label || unavailable}</td>
                            <td className="p-4 max-w-[200px] text-gray-300">{m.analysis?.objective || unavailable}</td>
                            <td className="p-4 text-center">
                              <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                                m.match_score > 75 ? "text-emerald-400 bg-emerald-500/10" : "text-yellow-400 bg-yellow-500/10"
                              }`}>{m.match_score}%</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                m.match_status === "APPROVED" 
                                  ? "text-emerald-400 bg-emerald-500/10"
                                  : m.match_status === "REJECTED"
                                  ? "text-red-400 bg-red-500/10"
                                  : "text-yellow-400 bg-yellow-500/10"
                              }`}>{m.match_status === "APPROVED" ? "مطابق مؤكد" : m.match_status === "REJECTED" ? "مستبعد" : "مراجعة مطلوبة (NEEDS_REVIEW)"}</span>
                            </td>
                            <td className="p-4 text-left">
                              <div className="flex items-center gap-2 justify-start">
                                <button
                                  onClick={() => setSelectedMatchForAnalysis(m)}
                                  className="p-1.5 bg-[#8B5CF6]/10 text-[#C4B5FD] rounded-lg border border-[#8B5CF6]/20 hover:bg-[#8B5CF6]/20"
                                  title="تحليلات الـ AI"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleApproveMatch(m.id)}
                                  className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20"
                                  title="موافقة"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRejectMatch(m.id)}
                                  className="p-1.5 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 hover:bg-red-500/20"
                                  title="استبعاد"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROFILE TARGET SETTINGS */}
          {activeTab === "profile" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Keywords management */}
              <div className="lg:col-span-2 bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#2a2a5c]/60 pb-3">
                  <h3 className="text-sm font-black text-white">الكلمات المفتاحية لمراقبة الإعلانات</h3>
                  <button
                    onClick={handleGenerateKeywords}
                    disabled={isGeneratingKeywords || !selectedProductId}
                    className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-400/20 px-3 py-2 rounded-xl text-[10.5px] font-black flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKeywords ? "animate-spin" : ""}`} />
                    {isGeneratingKeywords ? "جاري بناء الخطة..." : "توليد تلقائي من المنتج"}
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="مثال: فرشاة شعر حرارية، تصفيف، مصفف..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                    className="flex-1 bg-[#0f0f24] border border-[#2a2a5c] rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#8B5CF6]"
                  />
                  <button
                    onClick={handleAddKeyword}
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    أضف الكلمة
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {keywords.length === 0 ? (
                    <p className="text-[11px] text-[#a5a5c8] italic">لا توجد كلمات مفتاحية مضافة حتى الآن. أضف كلمات مفتاحية دقيقة تصف منتجك.</p>
                  ) : (
                    keywords.map((kw, idx) => (
                      <span 
                        key={idx}
                        className="bg-[#1c1c47] text-[#f5f5fa] border border-[#2a2a5c] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2"
                      >
                        {kw}
                        <button onClick={() => handleRemoveKeyword(idx)} className="text-red-400 hover:text-red-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <div className="bg-[#0B1E36]/30 p-3.5 rounded-xl border border-[#2a2a5c]/40 text-[10.5px] text-[#a5a5c8] leading-relaxed">
                  💡 يبدأ التخطيط بالاسم الدقيق، ثم التصحيح الإملائي والأسماء السوقية والفئة والوصف. يمكنك تعديل القائمة يدويًا قبل حفظها وتشغيل الرصد.
                </div>
              </div>

              {/* Providers and Scraper configurations */}
              <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-black text-white border-b border-[#2a2a5c]/60 pb-3">إعدادات وقنوات الفحص</h3>

                {/* Country selector */}
                <div className="space-y-2">
                  <label className="text-xs text-[#a5a5c8] font-black block">الدولة المستهدفة:</label>
                  <select
                    value={countries[0]}
                    onChange={(e) => setCountries([e.target.value])}
                    className="w-full bg-[#0f0f24] border border-[#2a2a5c] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value="EG">جمهورية مصر العربية (EG) 🇪🇬</option>
                    <option value="SA">المملكة العربية السعودية (SA) 🇸🇦</option>
                  </select>
                </div>

                {/* Providers checkboxes */}
                <div className="space-y-2">
                  <label className="text-xs text-[#a5a5c8] font-black block">قنوات الرصد والمراقبة إعلانيا:</label>
                  <div className="space-y-2 bg-[#0f0f24] p-3 rounded-xl border border-[#2a2a5c]">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                      <input
                        type="checkbox"
                        checked={providers.includes("meta")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProviders([...providers, "meta"]);
                          } else {
                            setProviders(providers.filter(p => p !== "meta"));
                          }
                        }}
                        className="rounded border-[#2a2a5c] text-[#8B5CF6] focus:ring-[#8B5CF6]"
                      />
                      <span>مكتبة إعلانات فيسبوك (Meta Ad Library)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                      <input
                        type="checkbox"
                        checked={providers.includes("tiktok")}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProviders([...providers, "tiktok"]);
                          } else {
                            setProviders(providers.filter(p => p !== "tiktok"));
                          }
                        }}
                        className="rounded border-[#2a2a5c] text-[#8B5CF6] focus:ring-[#8B5CF6]"
                      />
                      <span>مركز تيك توك الإبداعي (TikTok Ads Creative)</span>
                    </label>
                  </div>
                </div>

                {/* Scrape limit */}
                <div className="space-y-2">
                  <label className="text-xs text-[#a5a5c8] font-black block">الحد الأقصى لنتائج الكلمات (موصى به: 30):</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={maxResults}
                    onChange={(e) => setMaxResults(Number(e.target.value))}
                    className="w-full bg-[#0f0f24] border border-[#2a2a5c] rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? "جاري حفظ الإعدادات..." : "حفظ ملف الرصد والكلمات المفتاحية"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: JOBS MONITOR & PIPELINE */}
          {activeTab === "jobs" && (
            <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2a2a5c]/60 pb-3">
                <h3 className="text-sm font-black text-white">سجل وعمليات فحص الكلمات المباشر (Playwright)</h3>
                <span className="text-[10px] text-[#a5a5c8]">تحديث تلقائي كل 8 ثوانٍ</span>
              </div>

              {jobs.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <Info className="w-8 h-8 text-[#a5a5c8] opacity-50 mx-auto" />
                  <p className="text-xs text-white font-bold">لا توجد أي مهمة فحص مسجلة حتى الآن لهذا المنتج</p>
                  <p className="text-[10px] text-[#a5a5c8]">أطلق أول فحص إعلاني للبدء بسحب إعلانات فيسبوك وتيك توك التلقائية.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div 
                      key={job.id} 
                      className="bg-[#0f0f24]/80 border border-[#2a2a5c] rounded-2xl p-4.5 space-y-3"
                    >
                      {/* Job Header */}
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#a5a5c8] font-mono font-bold">مُعرّف المهمة: {String(job?.id ?? "").substring(0, 8)}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                            job.status === "COMPLETED" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : job.status === "PROCESSING"
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse"
                              : job.status === "CANCELLED"
                              ? "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            {job.status === "COMPLETED" ? "مكتملة بنجاح" : job.status === "PARTIAL" ? "اكتملت جزئياً" : job.status === "EMPTY" ? "لا توجد نتائج مرتبطة حالياً" : job.status === "PROCESSING" ? "جاري تشغيل الرصد..." : job.status === "PENDING" ? "في طابور التشغيل" : job.status === "CANCELLED" ? "تم الإلغاء" : job.status === "BLOCKED" ? "المصدر حظر الوصول" : "فشلت المهمة"}
                          </span>
                        </div>

                        <div className="text-[10px] text-gray-400 font-mono">
                          البداية: {job.started_at ? new Date(job.started_at).toLocaleString('ar-EG') : "قيد الإطلاق"}
                        </div>
                      </div>

                      {/* Info Row details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-gray-300">
                        <div>
                          <strong>الكلمات المفتاحية:</strong> {job.keywords.join(", ")}
                        </div>
                        <div>
                          <strong>القنوات:</strong> {job.providers.join(" & ")}
                        </div>
                        <div>
                          <strong>الدول:</strong> {job.country_codes.join(", ")}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">تقدّم المهمة:</span>
                          <span className="font-mono text-white font-bold">{job.progress_percentage}%</span>
                        </div>
                        <div className="h-2 bg-[#1c1c47] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              job.status === "COMPLETED" ? "bg-emerald-500" : "bg-cyan-500 animate-pulse"
                            }`} 
                            style={{ width: `${job.progress_percentage}%` }} 
                          />
                        </div>
                      </div>

                      {/* Cancel or error triggers */}
                      <div className="flex items-center justify-between text-[10.5px] flex-wrap gap-2">
                        <div>
                          {job.error_message && job.error_message.startsWith("COVERAGE_REPORT_JSON:") ? (
                            <button
                              onClick={() => {
                                try {
                                  const json = JSON.parse(job.error_message.replace("COVERAGE_REPORT_JSON:", ""));
                                  setSelectedCoverageReport(json);
                                } catch (e) {
                                  console.error("Failed to parse coverage report", e);
                                }
                              }}
                              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              عرض تقرير التغطية والاستكشاف المفصل
                            </button>
                          ) : (
                            <span className="text-red-400 font-semibold">{job.error_message || ""}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleLogs(job.id)}
                            className="bg-[#1c1c47] hover:bg-[#1C324F] text-[#a5a5c8] px-3 py-1 rounded-lg transition-all"
                          >
                            {expandedJobLogs === job.id ? "إخفاء التفاصيل" : "عرض التفاصيل السجل"}
                          </button>
                          {job.status === "PROCESSING" && (
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg transition-all"
                            >
                              إلغاء التشغيل
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Logs View */}
                      {expandedJobLogs === job.id && (
                        <div className="mt-3 bg-[#0a0a1a] border border-[#2a2a5c] rounded-xl p-3 space-y-2 max-h-60 overflow-y-auto font-mono text-[9.5px]">
                          {jobLogs[job.id] ? (
                            jobLogs[job.id].length > 0 ? (
                              jobLogs[job.id].map((log, idx) => (
                                <div key={idx} className={`flex flex-col gap-1 py-1 border-b border-[#2a2a5c]/30 last:border-0 ${
                                  log.status === "ERROR" ? "text-red-400" :
                                  log.status === "WARNING" ? "text-yellow-400" :
                                  log.status === "BLOCKED" ? "text-orange-400" : "text-[#a5a5c8]"
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold">[{new Date(log.created_at).toLocaleTimeString("ar-EG")}]</span>
                                    <span className="uppercase px-1.5 py-0.5 rounded-full bg-[#1c1c47] text-[8px]">{log.provider} - {log.step}</span>
                                  </div>
                                  <span className="break-words whitespace-pre-wrap">{log.message}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 text-[#73849A]">لا توجد تفاصيل لهذا الفحص</div>
                            )
                          ) : (
                            <div className="text-center py-4 flex items-center justify-center gap-2 text-[#73849A]">
                              <RefreshCw className="w-3 h-3 animate-spin" /> جاري التحميل...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRODUCT-LEVEL AD INTELLIGENCE */}
          {activeTab === "history" && (
            <AdsSpyHistoryTab 
              onSelectHistory={(entry) => {
                setSearchQuery("");
                setSkuQuery(entry.product.sku || "");
                setSelectedProductId(entry.product.id);
                setMatches(entry.matches);
                setSummary(entry.summary);
                setActiveTab("ads");
              }}
            />
          )}

          {activeTab === "summary" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "إعلانات نشطة", value: summary?.active_ads ?? 0, icon: Activity, color: "text-emerald-400" },
                  { label: "متوسط مدة التشغيل", value: `${summary?.median_running_duration_days ?? 0} يوم`, icon: Clock3, color: "text-cyan-400" },
                  { label: "تكرار الإبداع", value: summary?.repeated_creatives_count ?? 0, icon: Layers, color: "text-yellow-400" },
                  { label: "تغطية التحليل", value: `${summary?.analysis_coverage ?? 0}%`, icon: BrainCircuit, color: "text-[#A78BFA]" },
                ].map((metric) => (
                  <div key={metric.label} className="bg-[#0f0f24]/70 border border-[#2a2a5c] rounded-2xl p-4">
                    <metric.icon className={`w-4 h-4 ${metric.color} mb-3`} />
                    <strong className="text-lg text-white font-mono block">{metric.value}</strong>
                    <span className="text-[9.5px] text-[#a5a5c8]">{metric.label}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-black text-white flex items-center gap-2"><Target className="w-4 h-4 text-[#A78BFA]" /> أهداف الإعلانات المستنتجة</h3>
                  <BreakdownList items={summary?.objective_breakdown} emptyLabel="شغّل التحليل لاستخراج أهداف الإعلانات" />
                </div>
                <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-black text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" /> صيغ المحتوى</h3>
                  <BreakdownList items={summary?.content_type_breakdown} />
                </div>
                <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-black text-white flex items-center gap-2"><ExternalLink className="w-4 h-4 text-blue-400" /> أزرار الإجراء CTA</h3>
                  <BreakdownList items={summary?.cta_breakdown} />
                </div>
                <div className="bg-[#0a0a1a]/60 border border-[#2a2a5c] rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-black text-white flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" /> أكثر المعلنين ظهوراً</h3>
                  <BreakdownList items={summary?.advertiser_breakdown} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-black text-amber-300 flex items-center gap-2"><Compass className="w-4 h-4" /> فجوات وفرص مرصودة من البيانات</h3>
                  {summary?.opportunity_gaps?.length ? summary.opportunity_gaps.map((item, index) => (
                    <div key={index} className="flex gap-2 text-[10.5px] text-gray-200 leading-relaxed"><span className="text-amber-400 font-mono">{index + 1}.</span><span>{item}</span></div>
                  )) : <p className="text-[10px] text-[#a5a5c8] py-4">لا توجد بيانات كافية لاستخراج فجوة موثوقة حتى الآن.</p>}
                </div>
                <div className="bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-black text-[#C4B5FD] flex items-center gap-2"><Sparkles className="w-4 h-4" /> إجراءات مقترحة للمنتج</h3>
                  {summary?.product_recommendations?.length ? summary.product_recommendations.map((item, index) => (
                    <div key={index} className="flex gap-2 text-[10.5px] text-gray-200 leading-relaxed"><CheckCircle className="w-3.5 h-3.5 text-[#A78BFA] shrink-0 mt-0.5" /><span>{item}</span></div>
                  )) : <p className="text-[10px] text-[#a5a5c8] py-4">تظهر التوصيات بعد تحليل إعلان واحد موثوق على الأقل.</p>}
                </div>
              </div>

              <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-2xl p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-[#a5a5c8] leading-relaxed">التوزيعات مبنية على الإعلانات الفعلية غير المستبعدة لهذا المنتج. الهدف والجمهور والزاوية استنتاجات ذكاء اصطناعي وليست حقائق مصدرية، لذلك تعرض بطاقة كل إعلان نسبة الثقة والأدلة المتاحة.</p>
              </div>
            </div>
          )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED DRAWERS FOR AI ANALYTICS (MODAL DRAWER) */}
      {selectedMatchForAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a1a] border border-[#2a2a5c] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between text-right">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2a2a5c] flex items-center justify-between bg-[#0A1424]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#A78BFA] animate-pulse" />
                <h3 className="text-sm font-black text-white">التحليل الأوتوماتيكي المعمّق بالذكاء الاصطناعي (AI Analysis)</h3>
              </div>
              <button
                onClick={() => setSelectedMatchForAnalysis(null)}
                className="p-1 rounded-lg bg-[#1c1c47] text-[#a5a5c8] hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 flex-1">
              {selectedMatchForAnalysis.analysis ? (
                <div className="space-y-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0f0f24] border border-[#2a2a5c] p-3 rounded-xl">
                    <div className="flex flex-wrap gap-2 text-[9.5px]">
                      <span className="bg-[#1c1c47] text-cyan-300 px-2 py-1 rounded">{selectedMatchForAnalysis.analysis.content_type || adContentType(selectedMatchForAnalysis)}</span>
                      <span className="bg-[#1c1c47] text-[#C4B5FD] px-2 py-1 rounded">{selectedMatchForAnalysis.analysis.funnel_stage || unavailable}</span>
                      <span className="bg-[#1c1c47] text-gray-300 px-2 py-1 rounded">{selectedMatchForAnalysis.analysis.persuasion_framework || unavailable}</span>
                    </div>
                    <span className="font-mono text-[10px] text-[#A78BFA]">ثقة التحليل: {selectedMatchForAnalysis.analysis.analysis_confidence ?? unavailable}{typeof selectedMatchForAnalysis.analysis.analysis_confidence === "number" ? "%" : ""}</span>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/20 p-4.5 rounded-2xl space-y-3">
                    <div>
                      <strong className="text-[#C4B5FD] text-[10px] font-black block mb-1">الهدف التسويقي المستنتج</strong>
                      <p className="text-white leading-relaxed font-bold">{selectedMatchForAnalysis.analysis.objective || unavailable}</p>
                    </div>
                    <div className="border-t border-purple-500/15 pt-3">
                      <strong className="text-[#C4B5FD] text-[10px] font-black block mb-1">الخطاف والزاوية</strong>
                      <p className="text-gray-200 leading-relaxed">{selectedMatchForAnalysis.analysis.hook || unavailable}</p>
                      <p className="text-[10px] text-[#a5a5c8] mt-1">{selectedMatchForAnalysis.analysis.marketing_angle || unavailable}</p>
                    </div>
                  </div>

                  <div className="bg-[#0f0f24]/60 p-4 rounded-xl border border-[#2a2a5c]/60 space-y-2">
                    <strong className="text-cyan-400 block font-bold">ملخص نص الإعلان</strong>
                    <p className="text-gray-200 leading-relaxed">{selectedMatchForAnalysis.analysis.caption_summary || selectedMatchForAnalysis.ad?.body_text || unavailable}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 bg-[#0f0f24]/60 p-4 rounded-xl border border-[#2a2a5c]/60">
                      <strong className="text-cyan-400 block font-bold">الجمهور المستنتج</strong>
                      <p className="text-gray-200 leading-relaxed">{selectedMatchForAnalysis.analysis.target_audience || unavailable}</p>
                    </div>

                    <div className="space-y-2 bg-[#0f0f24]/60 p-4 rounded-xl border border-[#2a2a5c]/60">
                      <strong className="text-yellow-400 block font-bold">العرض كما ظهر</strong>
                      <p className="text-gray-200 leading-relaxed">{selectedMatchForAnalysis.analysis.offer || unavailable}</p>
                    </div>
                    <div className="space-y-2 bg-[#0f0f24]/60 p-4 rounded-xl border border-[#2a2a5c]/60">
                      <strong className="text-emerald-400 block font-bold">النبرة والأسلوب</strong>
                      <p className="text-gray-200 leading-relaxed">{selectedMatchForAnalysis.analysis.tone || unavailable} · {selectedMatchForAnalysis.analysis.creative_style || unavailable}</p>
                    </div>
                    <div className="space-y-2 bg-[#0f0f24]/60 p-4 rounded-xl border border-[#2a2a5c]/60">
                      <strong className="text-blue-400 block font-bold">CTA والمنصات</strong>
                      <p className="text-gray-200 leading-relaxed">{selectedMatchForAnalysis.ad?.cta_label || selectedMatchForAnalysis.analysis.cta || unavailable}</p>
                      <p className="text-[10px] text-[#a5a5c8]">{selectedMatchForAnalysis.analysis.platforms?.join("، ") || (selectedMatchForAnalysis.ad?.source_platform === "meta" ? "Meta" : "TikTok")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { title: "نقاط الألم", values: selectedMatchForAnalysis.analysis.pain_points },
                      { title: "عناصر الإثبات", values: selectedMatchForAnalysis.analysis.proof_elements },
                      { title: "الاعتراضات المعالجة", values: selectedMatchForAnalysis.analysis.objections },
                      { title: "محفزات عاطفية", values: selectedMatchForAnalysis.analysis.emotional_triggers },
                    ].map((section) => (
                      <div key={section.title} className="space-y-2 bg-[#0f0f24]/50 border border-[#2a2a5c]/60 p-4 rounded-xl">
                        <strong className="text-white font-black block">{section.title}</strong>
                        {section.values?.length ? (
                          <ul className="list-disc list-inside space-y-1 text-gray-300">{section.values.map((value, index) => <li key={index}>{value}</li>)}</ul>
                        ) : <p className="text-[#73849A] text-[10px]">{unavailable}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl space-y-2">
                    <strong className="text-emerald-400 block">الإجراء المقترح لهذا المنتج</strong>
                    <p className="text-gray-200 leading-relaxed">{selectedMatchForAnalysis.analysis.recommended_action || selectedMatchForAnalysis.analysis.differentiation_opportunities?.[0] || unavailable}</p>
                  </div>

                  <div className="bg-cyan-500/5 border border-cyan-500/15 p-4 rounded-xl space-y-2">
                    <strong className="text-cyan-400 block">أدلة الاستنتاج</strong>
                    {selectedMatchForAnalysis.analysis.evidence_notes?.length ? (
                      <ul className="list-disc list-inside space-y-1 text-gray-300">{selectedMatchForAnalysis.analysis.evidence_notes.map((value, index) => <li key={index}>{value}</li>)}</ul>
                    ) : <p className="text-[#73849A] text-[10px]">لم يسجل النموذج أدلة منفصلة لهذا التحليل القديم.</p>}
                  </div>
                </div>
              ) : (
                /* Honest empty state when analysis isn't yet ready */
                <div className="space-y-4 text-xs text-center p-8">
                  <Info className="w-8 h-8 text-[#a5a5c8] opacity-50 mx-auto animate-pulse" />
                  <p className="text-white font-bold text-xs mt-2">لا يتوفر تحليل ذكاء اصطناعي لهذا الإعلان حالياً</p>
                  <p className="text-[10px] text-[#a5a5c8]">يتم توليد تحليلات الخطافات والتسويق تلقائياً فقط للإعلانات الحاصلة على توافق عالٍ أثناء الفحص.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0A1424] border-t border-[#2a2a5c] flex justify-end">
              <button
                onClick={() => setSelectedMatchForAnalysis(null)}
                className="bg-[#1c1c47] hover:bg-[#1E334E] text-[#a5a5c8] hover:text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED COVERAGE AND DISCOVERY REPORT MODAL */}
      {selectedCoverageReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a1a] border border-[#2a2a5c] rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between text-right">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2a2a5c] flex items-center justify-between bg-[#0A1424]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">تقرير التغطية والاستكشاف المفصل (Detailed Coverage Report)</h3>
              </div>
              <button
                onClick={() => setSelectedCoverageReport(null)}
                className="p-1 rounded-lg bg-[#1c1c47] text-[#a5a5c8] hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 flex-1 text-xs text-gray-300">
              <div className="flex items-center justify-between bg-[#0f0f24] border border-[#2a2a5c] p-4 rounded-xl">
                <span className="font-bold">حالة التغطية الشاملة:</span>
                <span className={`px-2.5 py-1 rounded-full font-black text-[10px] ${
                  selectedCoverageReport.coverageStatus === "كاملة"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                }`}>
                  {selectedCoverageReport.coverageStatus === "كاملة" ? "كاملة (COMPLETE)" : "جزئية (PARTIAL)"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">الاستعلامات التي حُظرت أو فشلت</span>
                  <strong className="text-red-400 font-mono text-sm">{selectedCoverageReport.blockedOrFailedQueries ?? 0}</strong>
                </div>
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">الاستعلامات التي تم تجربتها</span>
                  <strong className="text-white font-mono text-sm">{selectedCoverageReport.queriesAttempted ?? 0}</strong>
                </div>
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">إجمالي نتائج الإعلانات الخام</span>
                  <strong className="text-white font-mono text-sm">{selectedCoverageReport.rawAdsFound ?? 0}</strong>
                </div>
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">الإعلانات الفريدة (غير المكررة)</span>
                  <strong className="text-purple-400 font-mono text-sm">{selectedCoverageReport.uniqueAdsFound ?? 0}</strong>
                </div>
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">الإعلانات المكررة المستبعدة</span>
                  <strong className="text-gray-400 font-mono text-sm">{selectedCoverageReport.duplicatesRemoved ?? 0}</strong>
                </div>
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">المطابقات المؤكدة تلقائياً</span>
                  <strong className="text-emerald-400 font-mono text-sm">{selectedCoverageReport.approvedMatches ?? 0}</strong>
                </div>
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">إعلانات تتطلب مراجعة بشرية</span>
                  <strong className="text-yellow-400 font-mono text-sm">{selectedCoverageReport.needsReviewMatches ?? 0}</strong>
                </div>
                <div className="bg-[#0f0f24]/60 p-3 rounded-xl border border-[#2a2a5c]/60 space-y-1">
                  <span className="text-[10px] text-[#a5a5c8] block">إعلانات مستبعدة لعدم صلتها</span>
                  <strong className="text-red-400 font-mono text-sm">{selectedCoverageReport.rejectedMatches ?? 0}</strong>
                </div>
              </div>

              {/* Methodological limitations alert */}
              <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl space-y-1.5">
                <strong className="text-amber-400 block font-bold">⚠️ تنبيه منهجي هام بشأن التغطية:</strong>
                <p className="text-[10.5px] leading-relaxed text-gray-200">
                  يرجى العلم أن هذه البيانات تعبر عن أقصى جهد رصد تمكّن الزاحف الذكي من تحصيله. مع ذلك، <strong>لا تدعي التغطية الشاملة بنسبة 100%</strong> نظراً لأن خوارزميات منصات الإعلانات قد تقوم بإخفاء بعض النتائج أو تقييدها أو تخصيصها بناء على الجغرافيا والتفاعل الفردي.
                </p>
                <p className="text-[10px] text-[#a5a5c8] leading-relaxed">
                  {selectedCoverageReport.coverageLimitations}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0A1424] border-t border-[#2a2a5c] flex justify-end">
              <button
                onClick={() => setSelectedCoverageReport(null)}
                className="bg-[#1c1c47] hover:bg-[#1E334E] text-[#a5a5c8] hover:text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
