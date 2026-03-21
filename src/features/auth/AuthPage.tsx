"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Brain, 
  AlertCircle
} from "lucide-react";
import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { redirectAfterAuth } from "@/lib/adminAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          redirectAfterAuth(result.user, router);
        }
      })
      .catch((err: unknown) => {
        const authErr = err as { code?: string; message?: string };
        const code = authErr?.code;
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Auth] Redirect result failed:", code, authErr?.message);
        }
        if (code === "auth/popup-blocked") return;
        if (code === "auth/invalid-credential" || code === "auth/credential-mismatch") {
          setError("Sign-in failed. Please try again.");
          return;
        }
        setError(authErr?.message ?? "Redirect sign-in failed");
      });
  }, [router]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      // Only auto-redirect verified users
      // Unverified email users must verify first
      if (user && (user.emailVerified ||
          user.providerData.some(
            p => p.providerId === "google.com"))) {
        redirectAfterAuth(user, router);
      }
    });
    return () => unsub();
  }, [router]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[Auth] Google sign-in attempt");
      }
      const { user } = await signInWithPopup(auth, googleProvider);
      await redirectAfterAuth(user, router);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      const code = authErr?.code;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Auth] Google sign-in failed:", code, authErr?.message);
      }
      if (code === "auth/popup-blocked") {
        setError("Popup blocked by browser. Redirecting to Google sign-in...");
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (code === "auth/popup-closed-by-user") {
        setError("Sign in cancelled.");
        setLoading(false);
        return;
      }
      if (code === "auth/configuration-not-found") {
        setError("System configuration error.");
        setLoading(false);
        return;
      }
      if (code === "auth/invalid-credential" || code === "auth/credential-mismatch") {
        setError("Google sign-in failed. Please try again.");
        setLoading(false);
        return;
      }
      setError(authErr?.message ?? "Sign-in failed");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (process.env.NODE_ENV !== "production") {
        console.log("[Auth] Email sign-in attempt, project:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
      }
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // Block unverified email accounts
      if (!user.emailVerified) {
        try {
          console.log("[Auth] Resending verification to:", user.email);
          await sendEmailVerification(user, {
            url: `${window.location.origin}/login?verified=true`,
            handleCodeInApp: false,
          });
          console.log("[Auth] Verification email resent successfully");
        } catch (verErr) {
          console.warn("[Auth] Could not resend verification:", verErr);
        }
        await signOut(auth);
        setError(
          "Please verify your email before signing in. " +
            "We just resent the verification link — " +
            "check your inbox."
        );
        setLoading(false);
        return;
      }

      await redirectAfterAuth(user, router);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      const code = authErr?.code;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Auth] Email sign-in failed:", code, authErr?.message);
      }
      let message = authErr?.message ?? "Sign-in failed";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        message = "Invalid email or password.";
      }
      if (code === "auth/email-already-in-use") message = "Email already in use.";
      if (code === "auth/weak-password") message = "Password too weak.";
      if (code === "auth/invalid-email") message = "Invalid email address.";
      setError(message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setResetError("Enter your email address above first.");
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err: unknown) {
      const authErr = err as { code?: string };
      if (authErr.code === "auth/user-not-found") {
        setResetError("No account found with this email address.");
      } else if (authErr.code === "auth/invalid-email") {
        setResetError("Please enter a valid email address.");
      } else {
        setResetError("Failed to send reset email. Try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#0a0f1e" }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(
        rgba(0,212,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,0.03) 
        1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, " + "rgba(0,212,255,0.06) 0%, transparent 70%)",
          top: "-200px",
          left: "-200px",
        }}
      />
      <div
        className="fixed pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, " + "rgba(0,255,136,0.04) 0%, transparent 70%)",
          bottom: "-100px",
          right: "-100px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] relative z-10 px-4"
      >
        <div
          className="relative rounded-2xl p-8 overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5), " + "0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: "linear-gradient(90deg, " + "transparent, #00d4ff, transparent)",
            }}
          />

          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
                boxShadow: "0 0 30px rgba(0,212,255,0.15)",
              }}
            >
              <Brain className="w-8 h-8" style={{ color: "#00d4ff" }} />
            </div>
            <h1 className="text-2xl font-bold text-center mb-1" style={{ color: "#e8edf5" }}>
              Welcome back
            </h1>
            <p className="text-sm text-center mb-8 font-mono" style={{ color: "#7a8aa0" }}>
              Enter your credentials to access RapiMed.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-5 p-3 rounded-xl flex items-center gap-3 text-xs"
              style={{
                background: "rgba(255,68,102,0.08)",
                border: "1px solid rgba(255,68,102,0.25)",
                color: "#ff4466",
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="block text-xs font-mono uppercase tracking-wider mb-1.5"
                style={{ color: "#7a8aa0" }}
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#3d4f66" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none pl-11 focus:border-[rgba(0,212,255,0.4)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.08)]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e8edf5",
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="block text-xs font-mono uppercase tracking-wider mb-1.5"
                style={{ color: "#7a8aa0" }}
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#3d4f66" }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none pl-11 focus:border-[rgba(0,212,255,0.4)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.08)]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e8edf5",
                  }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, " + "#00d4ff, #0099cc)",
                color: "#001a2e",
                boxShadow: "0 0 30px rgba(0,212,255,0.3)",
              }}
            >
              {loading ? (
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: "rgba(0,26,46,0.3)", borderTopColor: "#001a2e" }}
                />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex justify-end mt-2">
              {resetSent ? (
                <p className="text-xs font-mono" style={{ color: "#00ff88" }}>
                  ✓ Reset email sent — check your inbox
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-xs transition-colors disabled:opacity-50 font-mono"
                    style={{ color: "#7a8aa0" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#00d4ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#7a8aa0")}
                  >
                    {resetLoading ? "Sending..." : "Forgot password?"}
                  </button>
                  {resetError && (
                    <p className="text-xs ml-3" style={{ color: "#ff4466" }}>
                      {resetError}
                    </p>
                  )}
                </>
              )}
            </div>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/signup"
              className="text-xs hover:text-[#00d4ff] transition-colors font-mono"
              style={{ color: "#7a8aa0" }}
            >
              Don&apos;t have an account? Sign up
            </Link>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-xs font-mono"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  color: "#3d4f66",
                }}
              >
                Or continue with
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogleAuth}
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e8edf5",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs font-mono" style={{ color: "#3d4f66" }}>
          Encrypted & secure. Your data stays private.
        </p>
      </motion.div>
    </div>
  );
}
