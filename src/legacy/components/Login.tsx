// @ts-nocheck
import React, { useState } from "react";
import { auth, googleProvider, signInWithPopup, signOut } from "../lib/firebase";
import { AlertCircle, RefreshCw, LogIn } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const allowedEmail = "ziadalwafa0@gmail.com";
        if (result.user.email?.toLowerCase() !== allowedEmail) {
          await signOut(auth);
          setError("عذراً، هذا البريد الإلكتروني غير مصرح له بالدخول إلى لوحة التحكم.");
          return;
        }

        // Send login record to backend
        try {
          await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: result.user.email,
              displayName: result.user.displayName || ""
            })
          });
        } catch (authLogErr) {
          console.error("Failed to post login activity:", authLogErr);
        }

        onLoginSuccess(result.user);
      } else {
        setError("فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.");
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      if (err?.code === "auth/popup-blocked") {
        setError("تم حظر النافذة المنبثقة من قبل المتصفح. يرجى تفعيل النوافذ المنبثقة لموقعنا والمحاولة مجدداً.");
      } else {
        setError(err?.message || "حدث خطأ أثناء محاولة تسجيل الدخول عبر Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center p-4 select-none text-right font-sans" dir="rtl">
      <div className="w-full max-w-md bg-[#141432] border border-[#2a2a5c] rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366f1]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#24C78E]/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 bg-[#1c1c47] rounded-2xl border border-[#2a2a5c] text-[#6366f1] mb-2 shadow-inner">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">بوابة دخول المسؤول والشركاء</h1>
          <p className="text-xs text-[#a5a5c8] leading-relaxed">
            لوحة تحكم <span className="text-[#6366f1] font-bold">ستوك رادار</span> لتتبع ومطابقة مخزون الدروبشيبينغ في مصر. يرجى تسجيل الدخول باستخدام حساب Google المعتمد.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-sm text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="font-bold leading-normal">{error}</div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-14 bg-white hover:bg-gray-100 text-gray-900 text-sm font-black rounded-xl transition shadow-lg flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin text-gray-900" />
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.116C18.281 1.844 15.42 1 12.24 1 5.466 1 0 6.466 0 13.24s5.466 12.24 12.24 12.24c7.08 0 11.786-4.98 11.786-11.983 0-.806-.088-1.425-.195-2.212H12.24z"
                  />
                </svg>
                <span>تسجيل الدخول باستخدام Google</span>
              </>
            )}
          </button>
        </div>

        <div className="text-center pt-2 border-t border-[#2a2a5c]/40">
          <p className="text-[10px] text-[#a5a5c8]/50 font-medium">
            تخضع لوحة التحكم لحماية أمنية مشددة مدعومة بـ Firebase Auth. يتم توثيق كافة العمليات تلقائياً.
          </p>
        </div>
      </div>
    </div>
  );
}
