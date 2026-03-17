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
import { useBilling } from "./BillingContext";

const STORAGE_KEY = "neurosync_credits";

/** Credits per plan (single pool). Free: 3 (test), analysis costs 2, chat costs 1. */
const CREDITS_BY_PLAN: Record<string, number> = {
  free: 3,
  pro: 100,
  enterprise: 500,
};

const ANALYSIS_COST = 2;
const CHAT_COST = 1;

interface CreditsContextType {
  credits: number;
  canAnalyze: boolean;
  canChat: boolean;
  deductForAnalysis: () => void;
  deductForChat: () => void;
  refreshFromStorage: () => void;
  /** Dev only: grant credits for testing. */
  grantCreditsForTesting?: (amount: number) => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { billing } = useBilling();
  const defaultCredits = CREDITS_BY_PLAN[billing.plan] ?? CREDITS_BY_PLAN.free;

  const [credits, setCredits] = useState<number>(defaultCredits);
  const [initialized, setInitialized] = useState(false);

  const refreshFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const num = typeof parsed === "number" ? parsed : typeof parsed === "object" && parsed != null
          ? (parsed.upload ?? 0) + (parsed.query ?? 0)
          : defaultCredits;
        setCredits(Math.max(0, Math.floor(Number(num))));
      } else {
        setCredits(defaultCredits);
      }
    } catch {
      setCredits(defaultCredits);
    }
    setInitialized(true);
  }, [defaultCredits]);

  useEffect(() => {
    refreshFromStorage();
  }, [refreshFromStorage]);

  useEffect(() => {
    if (!initialized) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(credits));
    } catch {}
  }, [credits, initialized]);

  const deductForAnalysis = useCallback(() => {
    setCredits((prev) => {
      const next = Math.max(0, prev - ANALYSIS_COST);
      if (process.env.NODE_ENV !== "production") {
        console.log("[Credits] analysis:", { before: prev, deducted: prev - next, after: next, actionType: "analysis" });
      }
      return next;
    });
  }, []);

  const deductForChat = useCallback(() => {
    setCredits((prev) => {
      if (prev < CHAT_COST) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[Credits] chat blocked:", { before: prev, actionType: "chat" });
        }
        return prev;
      }
      const next = prev - CHAT_COST;
      if (process.env.NODE_ENV !== "production") {
        console.log("[Credits] chat:", { before: prev, deducted: CHAT_COST, after: next, actionType: "chat" });
      }
      return next;
    });
  }, []);

  const canAnalyze = credits >= ANALYSIS_COST;
  const canChat = credits >= CHAT_COST;

  const grantCreditsForTesting = useCallback((amount: number) => {
    if (process.env.NODE_ENV !== "production") {
      setCredits(Math.max(0, Math.floor(amount)));
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Math.max(0, Math.floor(amount))));
      }
      console.log(`[Credits] Granted ${amount} for testing`);
    }
  }, []);

  const value = useMemo(
    () => ({
      credits,
      canAnalyze,
      canChat,
      deductForAnalysis,
      deductForChat,
      refreshFromStorage,
      grantCreditsForTesting: process.env.NODE_ENV !== "production" ? grantCreditsForTesting : undefined,
    }),
    [credits, canAnalyze, canChat, deductForAnalysis, deductForChat, refreshFromStorage, grantCreditsForTesting]
  );

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditsContext);
  if (ctx === undefined) {
    throw new Error("useCredits must be used within a CreditsProvider");
  }
  return ctx;
}
