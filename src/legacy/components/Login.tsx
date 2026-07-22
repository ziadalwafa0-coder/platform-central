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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 select-none text-right font-sans relative overflow-hidden" dir="rtl">
      {/* Ambient background orbs */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full bg-violet-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#a5a5c8_1px,transparent_1px),linear-gradient(90deg,#a5a5c8_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative w-full max-w-md">
        {/* Gradient border wrapper */}
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/60 via-violet-500/30 to-transparent" />
        <div className="relative bg-[#141432]/90 backdrop-blur-xl rounded-3xl p-9 space-y-8 shadow-[0_30px_80px_-20px_rgba(79,70,229,0.35)]">
          <div className="text-center space-y-4">
            <div className="mx-auto inline-flex p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/40">
              <LogIn className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
                بوابة دخول المسؤول والشركاء
              </h1>
              <p className="text-[13px] text-[#a5a5c8] leading-relaxed max-w-sm mx-auto">
                لوحة تحكم <span className="text-indigo-300 font-bold">ستوك رادار</span> لتتبع
                ومطابقة مخزون الدروبشيبينغ في مصر. سجّل الدخول باستخدام حساب Google المعتمد.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3 text-sm text-red-300">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="font-semibold leading-normal">{error}</div>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group relative w-full h-14 rounded-2xl bg-white text-gray-900 text-sm font-bold shadow-xl shadow-black/30 transition-all duration-200 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center justify-center gap-3 cursor-pointer overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-200/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.116C18.281 1.844 15.42 1 12.24 1 5.466 1 0 6.466 0 13.24s5.466 12.24 12.24 12.24c7.08 0 11.786-4.98 11.786-11.983 0-.806-.088-1.425-.195-2.212H12.24z" />
                </svg>
                <span>تسجيل الدخول باستخدام Google</span>
              </>
            )}
          </button>

          <div className="text-center pt-4 border-t border-white/5">
            <p className="text-[10px] text-[#a5a5c8]/60 font-medium leading-relaxed">
              تخضع لوحة التحكم لحماية أمنية مشددة مدعومة بـ Firebase Auth. يتم توثيق كافة العمليات تلقائياً.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
