"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export interface TokenBalances {
  reportTokens: number;
  agentTokens: number;
  supportTokens: number;
  reportTokensTotal: number;
  agentTokensTotal: number;
  supportTokensTotal: number;
  reportTokensUsed: number;
  agentTokensUsed: number;
  supportTokensUsed: number;
  plan: string;
  resetAt: string;
}

interface CreditsContextType {
  balances: TokenBalances;
  loading: boolean;
  canAnalyze: boolean;
  canChat: boolean;
  canSupport: boolean;
  deductForAnalysis: () => Promise<boolean>;
  deductForChat: () => Promise<boolean>;
  deductForSupport: () => Promise<boolean>;
  refreshCredits: () => Promise<void>;
  credits: number;
  /** Dev-only: bump local report tokens for testing (does not persist). */
  grantCreditsForTesting?: (amount: number) => void;
}

const DEFAULT_BALANCES: TokenBalances = {
  reportTokens: 0,
  agentTokens: 0,
  supportTokens: 0,
  reportTokensTotal: 3,
  agentTokensTotal: 10,
  supportTokensTotal: 5,
  reportTokensUsed: 0,
  agentTokensUsed: 0,
  supportTokensUsed: 0,
  plan: "free",
  resetAt: "",
};

function normalizeApiPayload(raw: Record<string, unknown>): TokenBalances {
  return {
    reportTokens: typeof raw.reportTokens === "number" ? raw.reportTokens : DEFAULT_BALANCES.reportTokens,
    agentTokens: typeof raw.agentTokens === "number" ? raw.agentTokens : DEFAULT_BALANCES.agentTokens,
    supportTokens: typeof raw.supportTokens === "number" ? raw.supportTokens : DEFAULT_BALANCES.supportTokens,
    reportTokensTotal:
      typeof raw.reportTokensTotal === "number" ? raw.reportTokensTotal : DEFAULT_BALANCES.reportTokensTotal,
    agentTokensTotal:
      typeof raw.agentTokensTotal === "number" ? raw.agentTokensTotal : DEFAULT_BALANCES.agentTokensTotal,
    supportTokensTotal:
      typeof raw.supportTokensTotal === "number" ? raw.supportTokensTotal : DEFAULT_BALANCES.supportTokensTotal,
    reportTokensUsed:
      typeof raw.reportTokensUsed === "number" ? raw.reportTokensUsed : DEFAULT_BALANCES.reportTokensUsed,
    agentTokensUsed:
      typeof raw.agentTokensUsed === "number" ? raw.agentTokensUsed : DEFAULT_BALANCES.agentTokensUsed,
    supportTokensUsed:
      typeof raw.supportTokensUsed === "number" ? raw.supportTokensUsed : DEFAULT_BALANCES.supportTokensUsed,
    plan: typeof raw.plan === "string" ? raw.plan : "free",
    resetAt: typeof raw.resetAt === "string" ? raw.resetAt : "",
  };
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [balances, setBalances] = useState<TokenBalances>(DEFAULT_BALANCES);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      if (!user) {
        setBalances(DEFAULT_BALANCES);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!uid) return;
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch("/api/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const raw = (await res.json()) as Record<string, unknown>;
        setBalances(normalizeApiPayload(raw));
      }
    } catch (err) {
      console.error("[Credits] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) void refreshCredits();
  }, [uid, refreshCredits]);

  const deduct = useCallback(async (type: "report" | "agent" | "support"): Promise<boolean> => {
    const user = auth.currentUser;
    if (!user) return false;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = (await res.json()) as { newBalance?: number };
        const key = `${type}Tokens` as keyof TokenBalances;
        const usedKey = `${type}TokensUsed` as keyof TokenBalances;
        setBalances((prev) => ({
          ...prev,
          [key]: typeof data.newBalance === "number" ? data.newBalance : (prev[key] as number) - 1,
          [usedKey]: (prev[usedKey] as number) + 1,
        }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const deductForAnalysis = useCallback(() => deduct("report"), [deduct]);
  const deductForChat = useCallback(() => deduct("agent"), [deduct]);
  const deductForSupport = useCallback(() => deduct("support"), [deduct]);

  const canAnalyze = balances.reportTokens > 0;
  const canChat = balances.agentTokens > 0;
  const canSupport = balances.supportTokens > 0;

  const credits = balances.reportTokens + balances.agentTokens + balances.supportTokens;

  const grantCreditsForTesting = useCallback((amount: number) => {
    if (process.env.NODE_ENV !== "production") {
      const n = Math.max(0, Math.floor(amount));
      setBalances((prev) => ({ ...prev, reportTokens: n }));
    }
  }, []);

  const value = useMemo(
    () => ({
      balances,
      loading,
      canAnalyze,
      canChat,
      canSupport,
      deductForAnalysis,
      deductForChat,
      deductForSupport,
      refreshCredits,
      credits,
      grantCreditsForTesting: process.env.NODE_ENV !== "production" ? grantCreditsForTesting : undefined,
    }),
    [
      balances,
      loading,
      canAnalyze,
      canChat,
      canSupport,
      deductForAnalysis,
      deductForChat,
      deductForSupport,
      refreshCredits,
      credits,
      grantCreditsForTesting,
    ]
  );

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used within CreditsProvider");
  return ctx;
}
