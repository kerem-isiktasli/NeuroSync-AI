"use client";

import React, { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useBilling } from "@/context/BillingContext";
import { Check, Zap, CreditCard, Calendar, ShoppingBag } from "lucide-react";
import PricingModal from "./PricingModal";
import DowngradeConfirmModal from "./DowngradeConfirmModal";
import BuyCreditsModal from "./BuyCreditsModal";
import { AnimatePresence } from "framer-motion";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    features: ["Basic Analysis (5/mo)", "Standard Support", "Community Access"],
    color: "slate",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$29",
    features: ["Unlimited Analysis", "Priority Support", "Advanced 3D Models", "API Access"],
    color: "emerald",
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    features: ["Custom Solutions", "Dedicated Manager", "SLA", "On-premise Deployment"],
    color: "blue",
  },
];

export default function SubscriptionView() {
  const { t } = useSettings();
  const { billing, setPlan, cancelRenewal, restoreRenewal } = useBilling();
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [buyCreditsModalOpen, setBuyCreditsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ name: "", price: "", action: "upgrade" as "upgrade" | "manage" | "enterprise" });
  const [downgradeConfirming, setDowngradeConfirming] = useState(false);

  const currentPlan = billing.plan;
  const isPro = currentPlan === "pro";
  const isEnterprise = currentPlan === "enterprise";

  const handleSwitchPlan = (planId: typeof billing.plan) => {
    if (planId === "free") {
      setDowngradeModalOpen(true);
      return;
    }
    if (planId === "enterprise") {
      setSelectedPlan({ name: "Enterprise", price: "Custom", action: "enterprise" });
      setPricingModalOpen(true);
      return;
    }
    setSelectedPlan({ name: "Pro", price: "$29", action: "upgrade" });
    setPricingModalOpen(true);
  };

  const handleDowngradeConfirm = () => {
    setDowngradeConfirming(true);
    setTimeout(() => {
      setPlan("free");
      setDowngradeConfirming(false);
      setDowngradeModalOpen(false);
    }, 500);
  };

  const handleManagePayments = () => {
    setSelectedPlan({ name: "Pro", price: "$29", action: "manage" });
    setPricingModalOpen(true);
  };

  const displayPlanName = isEnterprise ? "Enterprise" : isPro ? "Pro" : "Free";
  const nextBilling = billing.nextBillingDate || (isPro ? "March 4, 2026" : null);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-theme-text-primary">{t("subscription")}</h2>
        <p className="text-theme-text-secondary">Manage your plan, credits, and billing.</p>
      </header>

      {/* Current Plan Status */}
      <div className="luxo-card p-8 bg-gradient-to-br from-theme-accent/10 to-theme-surface border-theme-accent/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-theme-accent text-theme-accent-foreground text-xs font-bold uppercase tracking-wider">
                {t("active")}
              </span>
              <h3 className="text-2xl font-bold text-theme-text-primary">
                {t("current_plan")}: {displayPlanName}
              </h3>
              {billing.isCanceled && isPro && (
                <span className="px-3 py-1 rounded-full bg-theme-warning/20 text-theme-warning text-xs font-semibold">
                  Renewal canceled
                </span>
              )}
            </div>
            {nextBilling && (
              <p className="text-theme-text-secondary flex items-center gap-2">
                <Calendar size={16} />
                {t("next_billing")}: <span className="text-theme-text-primary font-mono">{nextBilling}</span>
              </p>
            )}
            {!nextBilling && isPro && !billing.isCanceled && (
              <p className="text-theme-text-muted text-sm">Billing date will appear after first payment.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {isPro && !billing.isCanceled && (
              <button
                onClick={handleManagePayments}
                className="px-6 py-3 rounded-xl bg-theme-surface-elevated hover:bg-theme-surface border border-theme-border text-theme-text-primary font-medium transition-colors"
              >
                {t("manage_payments")}
              </button>
            )}
            {!isEnterprise && (
              <button
                onClick={() => handleSwitchPlan("enterprise")}
                className="premium-btn px-6 py-3 shadow-lg"
              >
                {t("upgrade")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Buy Credits Section */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider">
          Credits
        </h3>
        <div className="luxo-card p-6 border border-theme-border">
          <p className="text-theme-text-secondary mb-4">
            Credits power scans (1 per upload) and AI questions (1 per query). Purchase add-on packs when you need more.
          </p>
          <button
            onClick={() => setBuyCreditsModalOpen(true)}
            className="premium-btn px-6 py-3 flex items-center gap-2"
          >
            <ShoppingBag size={18} />
            {t("buy_credits")}
          </button>
        </div>
      </section>

      {/* Plan Tiers */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-theme-text-primary uppercase tracking-wider">
          Plans
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isActive = currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-6 border transition-all duration-300 ${
                  isActive
                    ? "bg-theme-accent/10 border-theme-accent/40 shadow-2xl scale-105 z-10"
                    : "bg-theme-surface-elevated border-theme-border hover:bg-theme-surface"
                }`}
              >
                {isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-theme-accent text-theme-accent-foreground text-[10px] font-bold uppercase tracking-widest shadow-lg">
                    {t("current_plan")}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-lg font-bold ${isActive ? "text-theme-accent" : "text-theme-text-primary"}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-black text-theme-text-primary">{plan.price}</span>
                    {plan.price !== "Custom" && (
                      <span className="text-theme-text-muted text-sm">/month</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-theme-text-secondary">
                      <Check size={16} className={isActive ? "text-theme-accent" : "text-theme-text-muted"} />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.id === "free" ? (
                  <button
                    onClick={() => !isActive && handleSwitchPlan("free")}
                    disabled={isActive}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all bg-theme-surface border border-theme-border text-theme-text-primary opacity-75 cursor-default"
                  >
                    {isActive ? "Current plan" : t("switch_plan")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSwitchPlan(plan.id)}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? "bg-theme-accent text-theme-accent-foreground hover:bg-theme-accent/90"
                        : "bg-theme-surface border border-theme-border text-theme-text-primary hover:bg-theme-surface-elevated"
                    }`}
                  >
                    {isActive ? t("manage_plan") : t("switch_plan")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Cancel / Restore renewal (Pro only) */}
      {isPro && (
        <section className="space-y-2">
          {billing.isCanceled ? (
            <button
              onClick={restoreRenewal}
              className="text-sm text-theme-accent hover:underline transition-colors"
            >
              Restore renewal
            </button>
          ) : (
            <button
              onClick={cancelRenewal}
              className="text-sm text-theme-text-muted hover:text-theme-danger transition-colors"
            >
              Cancel renewal at period end
            </button>
          )}
        </section>
      )}

      <AnimatePresence>
        {pricingModalOpen && (
          <PricingModal
            isOpen={pricingModalOpen}
            onClose={() => setPricingModalOpen(false)}
            planName={selectedPlan.name}
            price={selectedPlan.price}
            action={selectedPlan.action}
          />
        )}
        {downgradeModalOpen && (
          <DowngradeConfirmModal
            isOpen={downgradeModalOpen}
            onClose={() => setDowngradeModalOpen(false)}
            onConfirm={handleDowngradeConfirm}
            isConfirming={downgradeConfirming}
          />
        )}
        {buyCreditsModalOpen && (
          <BuyCreditsModal
            isOpen={buyCreditsModalOpen}
            onClose={() => setBuyCreditsModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
