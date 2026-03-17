"use client";

import React, { useState, useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
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
      if (user) redirectAfterAuth(user, router);
    });
    return () => unsub();
  }, [router]);

  // Mouse tracking for glow effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

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

  return (
    <div 
      className="min-h-screen bg-theme-bg flex items-center justify-center relative overflow-hidden font-sans selection:bg-theme-accent/30 transition-colors duration-300"
      onMouseMove={handleMouseMove}
    >
      {/* Noise Texture */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay pointer-events-none" />

      {/* Mouse Follow Glow */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              hsl(var(--theme-accent) / 0.12),
              transparent 80%
            )
          `,
        }}
      />

      {/* Main Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] relative z-10 px-4"
      >
        <div className="relative rounded-2xl md:rounded-3xl bg-theme-surface-elevated border border-theme-border shadow-xl p-6 md:p-8 overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
               <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center">
                 <Brain className="w-7 h-7 md:w-8 md:h-8 text-theme-accent" />
               </div>
            </div>
            <h1 className="text-h1 mb-2">
              Welcome back
            </h1>
            <p className="text-body text-sm">
              Enter your credentials to access RapiMed.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-5 p-3 rounded-xl bg-theme-danger/10 border border-theme-danger/20 flex items-center gap-3 text-theme-danger text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-label ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3.5 pl-11 pr-4 text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:border-theme-focus-ring focus:ring-2 focus:ring-theme-focus-ring/20 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-label ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-theme-surface border border-theme-border rounded-xl py-3.5 pl-11 pr-4 text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:border-theme-focus-ring focus:ring-2 focus:ring-theme-focus-ring/20 transition-colors"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full premium-btn text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-theme-accent-foreground/30 border-t-theme-accent-foreground rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link 
              href="/signup"
              className="text-caption text-theme-text-muted hover:text-theme-text-primary transition-colors font-medium"
            >
              Don&apos;t have an account? Sign up
            </Link>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-theme-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-theme-surface-elevated px-3 text-caption">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleAuth}
            type="button"
            className="w-full flex items-center justify-center gap-2 bg-theme-surface hover:bg-theme-surface-elevated border border-theme-border text-theme-text-primary text-sm font-medium py-3 rounded-xl transition-colors duration-200"
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

        <p className="mt-6 text-center text-caption text-theme-text-muted">
          Encrypted & secure. Your data stays private.
        </p>
      </motion.div>
    </div>
  );
}
