/**
 * Admin authorization — Firestore roles/{uid}.role === "admin" as source of truth.
 * Server-side APIs use this; client uses /api/admin/verify for consistency.
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "firebase/auth";

const ROLES_COLLECTION = "roles";

export async function isAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const ref = doc(db, ROLES_COLLECTION, userId);
    const snap = await getDoc(ref);
    return snap.data()?.role === "admin";
  } catch {
    return false;
  }
}

type RouterLike = { replace: (url: string) => void };

/** Call /api/admin/verify and redirect to /admin or /dashboard based on role. */
export async function redirectAfterAuth(user: User, router: RouterLike): Promise<void> {
  try {
    const token = await user.getIdToken(true);
    if (!token) {
      if (process.env.NODE_ENV !== "production") console.warn("[redirectAfterAuth] getIdToken returned empty");
      router.replace("/dashboard");
      return;
    }
    const res = await fetch("/api/admin/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (process.env.NODE_ENV !== "production") {
      console.log("[redirectAfterAuth] verify response:", data, "status:", res.status);
    }
    router.replace(data.admin ? "/admin" : "/dashboard");
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[redirectAfterAuth] failed:", e);
    }
    router.replace("/dashboard");
  }
}
