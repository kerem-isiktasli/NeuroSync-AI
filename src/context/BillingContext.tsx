"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type PlanId = "free" | "pro" | "enterprise";

export interface BillingState {
  plan: PlanId;
  nextBillingDate: string | null;
  isCanceled: boolean; // renewal canceled at period end
}

const DEFAULT_STATE: BillingState = {
  plan: "free",
  nextBillingDate: null,
  isCanceled: false,
};

const STORAGE_KEY = "neurosync_billing";

interface BillingContextType {
  billing: BillingState;
  setPlan: (plan: PlanId) => void;
  setNextBillingDate: (date: string | null) => void;
  cancelRenewal: () => void;
  restoreRenewal: () => void;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export function BillingProvider({ children }: { children: ReactNode }) {
  const [billing, setBilling] = useState<BillingState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BillingState>;
        setBilling((prev) => ({
          ...prev,
          ...(parsed.plan && { plan: parsed.plan as PlanId }),
          ...(parsed.nextBillingDate !== undefined && { nextBillingDate: parsed.nextBillingDate }),
          ...(parsed.isCanceled !== undefined && { isCanceled: parsed.isCanceled }),
        }));
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(billing));
    } catch {}
  }, [billing]);

  const setPlan = useCallback((plan: PlanId) => {
    setBilling((prev) => ({ ...prev, plan, isCanceled: false }));
  }, []);

  const setNextBillingDate = useCallback((date: string | null) => {
    setBilling((prev) => ({ ...prev, nextBillingDate: date }));
  }, []);

  const cancelRenewal = useCallback(() => {
    setBilling((prev) => ({ ...prev, isCanceled: true }));
  }, []);

  const restoreRenewal = useCallback(() => {
    setBilling((prev) => ({ ...prev, isCanceled: false }));
  }, []);

  const value = React.useMemo(
    () => ({
      billing,
      setPlan,
      setNextBillingDate,
      cancelRenewal,
      restoreRenewal,
    }),
    [billing, setPlan, setNextBillingDate, cancelRenewal, restoreRenewal]
  );

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error("useBilling must be used within a BillingProvider");
  }
  return context;
}
