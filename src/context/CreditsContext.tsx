"use client";

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useMemo, type ReactNode,
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
  // Legacy compatibility — sum of all tokens
  credits: number;
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
        const data = await res.json() as TokenBalances;
        setBalances(data);
      }
    } catch (err) {
      console.error("[Credits] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) refreshCredits();
  }, [uid, refreshCredits]);

  const deduct = useCallback(async (
    type: "report" | "agent" | "support"
  ): Promise<boolean> => {
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
        const data = await res.json();
        const key = `${type}Tokens` as keyof TokenBalances;
        const usedKey = `${type}TokensUsed` as keyof TokenBalances;
        setBalances(prev => ({
          ...prev,
          [key]: data.newBalance,
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

  const value = useMemo(() => ({
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
  }), [balances, loading, canAnalyze, canChat,
      canSupport, deductForAnalysis, deductForChat,
      deductForSupport, refreshCredits, credits]);

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error(
    "useCredits must be used within CreditsProvider");
  return ctx;
}
