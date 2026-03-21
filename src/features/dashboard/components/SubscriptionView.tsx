"use client";

import React, { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useBilling } from "@/context/BillingContext";
import { useCredits } from "@/context/CreditsContext";
import {
  Check, Calendar, ShoppingBag, Shield,
  Zap, FileText, MessageSquare, Headphones,
  X, Lock,
} from "lucide-react";
import DowngradeConfirmModal from "./DowngradeConfirmModal";
import { AnimatePresence, motion } from "framer-motion";

// ─── Plan definitions with new token system ───

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: null,
    description: "Get started with essential features",
    tokens: {
      report: 3,
      agent: 10,
      support: 5,
    },
    features: [
      "3 report tokens / month",
      "10 agent tokens / month",
      "5 support tokens / month",
      "Standard AI model",
      "Community support",
    ],
    accent: "#7a8aa0",
    accentBg: "rgba(122,138,160,0.08)",
    accentBorder: "rgba(122,138,160,0.2)",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For patients with regular imaging needs",
    tokens: {
      report: 30,
      agent: 100,
      support: 50,
    },
    features: [
      "30 report tokens / month",
      "100 agent tokens / month",
      "50 support tokens / month",
      "Priority AI model",
      "Priority support",
      "Report history",
    ],
    accent: "#00d4ff",
    accentBg: "rgba(0,212,255,0.08)",
    accentBorder: "rgba(0,212,255,0.3)",
    popular: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    period: null,
    description: "For clinics and healthcare organizations",
    tokens: {
      report: -1,
      agent: -1,
      support: -1,
    },
    features: [
      "Unlimited report tokens",
      "Unlimited agent tokens",
      "Unlimited support tokens",
      "Dedicated AI instance",
      "Dedicated account manager",
      "SLA guarantee",
      "On-premise deployment",
      "Custom integrations",
    ],
    accent: "#00ff88",
    accentBg: "rgba(0,255,136,0.08)",
    accentBorder: "rgba(0,255,136,0.3)",
  },
];

// ─── Token add-on packs ───

const TOKEN_PACKS = [
  {
    id: "report-5",
    label: "Report Pack",
    desc: "5 additional report tokens",
    tokens: { report: 5, agent: 0, support: 0 },
    price: "$9",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.2)",
  },
  {
    id: "agent-50",
    label: "Agent Pack",
    desc: "50 additional agent tokens",
    tokens: { report: 0, agent: 50, support: 0 },
    price: "$12",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.08)",
    border: "rgba(0,255,136,0.2)",
    popular: true,
  },
  {
    id: "support-20",
    label: "Support Pack",
    desc: "20 additional support tokens",
    tokens: { report: 0, agent: 0, support: 20 },
    price: "$7",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.2)",
  },
  {
    id: "bundle",
    label: "Full Bundle",
    desc: "10R + 40A + 15S tokens",
    tokens: { report: 10, agent: 40, support: 15 },
    price: "$24",
    color: "#e8edf5",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.15)",
    bestValue: true,
  },
];

export default function SubscriptionView() {
  const { t } = useSettings();
  const { billing, setPlan, cancelRenewal, restoreRenewal } = useBilling();
  const { balances } = useCredits();

  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [downgradeConfirming, setDowngradeConfirming] = useState(false);
  const [buyPackOpen, setBuyPackOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const currentPlan = billing.plan;
  const isPro = currentPlan === "pro";
  const isEnterprise = currentPlan === "enterprise";
  const isFree = currentPlan === "free";
  const displayPlanName = isEnterprise ? "Enterprise" : isPro ? "Pro" : "Free";
  const nextBilling = billing.nextBillingDate || (isPro ? "April 1, 2026" : null);

  const handleDowngradeConfirm = () => {
    setDowngradeConfirming(true);
    setTimeout(() => {
      setPlan("free");
      setDowngradeConfirming(false);
      setDowngradeModalOpen(false);
    }, 500);
  };

  const TOKEN_ICONS = {
    report: FileText,
    agent: Zap,
    support: Headphones,
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8"
      style={{ color: "#e8edf5" }}>

      {/* Header */}
      <header>
        <h2 className="text-2xl font-bold" style={{ color: "#e8edf5" }}>
          {t("subscription")}
        </h2>
        <p className="text-sm font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
          Manage your plan and token balances
        </p>
      </header>

      {/* Current plan status */}
      <div className="rounded-2xl p-6"
        style={{
          background: "rgba(0,212,255,0.05)",
          border: "1px solid rgba(0,212,255,0.15)",
        }}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(0,255,136,0.1)",
                  border: "1px solid rgba(0,255,136,0.25)",
                  color: "#00ff88",
                }}>
                ACTIVE
              </span>
              <h3 className="text-xl font-bold" style={{ color: "#e8edf5" }}>
                {displayPlanName} Plan
              </h3>
              {billing.isCanceled && isPro && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono"
                  style={{
                    background: "rgba(255,170,0,0.1)",
                    color: "#ffaa00",
                    border: "1px solid rgba(255,170,0,0.2)",
                  }}>
                  Renewal canceled
                </span>
              )}
            </div>
            {nextBilling && (
              <p className="text-sm font-mono flex items-center gap-2"
                style={{ color: "#7a8aa0" }}>
                <Calendar size={14} />
                Next billing: <span style={{ color: "#e8edf5" }}>{nextBilling}</span>
              </p>
            )}
            {balances.resetAt && (
              <p className="text-xs font-mono mt-1" style={{ color: "#3d4f66" }}>
                Tokens reset:{" "}
                {new Date(balances.resetAt).toLocaleDateString("en-US", {
                  month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            {isPro && !billing.isCanceled && (
              <button
                onClick={() => setUpgradeOpen(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e8edf5",
                }}>
                Manage billing
              </button>
            )}
            {isFree && (
              <button
                onClick={() => setUpgradeOpen(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                  color: "#001a2e",
                }}>
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Token balances */}
      <section className="space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-widest"
          style={{ color: "#7a8aa0" }}>
          Token Balances
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              key: "report" as const,
              label: "Report Tokens",
              desc: "Generate AI reports",
              current: balances.reportTokens,
              total: balances.reportTokensTotal,
              used: balances.reportTokensUsed,
              color: "#00d4ff",
              bg: "rgba(0,212,255,0.06)",
              border: "rgba(0,212,255,0.2)",
            },
            {
              key: "agent" as const,
              label: "Agent Tokens",
              desc: "AI chat & medical questions",
              current: balances.agentTokens,
              total: balances.agentTokensTotal,
              used: balances.agentTokensUsed,
              color: "#00ff88",
              bg: "rgba(0,255,136,0.06)",
              border: "rgba(0,255,136,0.2)",
            },
            {
              key: "support" as const,
              label: "Support Tokens",
              desc: "Customer support messages",
              current: balances.supportTokens,
              total: balances.supportTokensTotal,
              used: balances.supportTokensUsed,
              color: "#ffaa00",
              bg: "rgba(255,170,0,0.06)",
              border: "rgba(255,170,0,0.2)",
            },
          ].map((tok) => {
            const Icon = TOKEN_ICONS[tok.key];
            return (
              <div key={tok.label}
                className="rounded-2xl p-5"
                style={{
                  background: tok.bg,
                  border: `1px solid ${tok.border}`,
                }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: `${tok.color}15`,
                        border: `1px solid ${tok.color}30`,
                      }}>
                      <Icon size={15} style={{ color: tok.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#e8edf5" }}>
                        {tok.label}
                      </p>
                      <p className="text-[10px] font-mono" style={{ color: "#7a8aa0" }}>
                        {tok.desc}
                      </p>
                    </div>
                  </div>
                  <p className="text-3xl font-black" style={{ color: tok.color }}>
                    {tok.current === 999999 ? "∞" : tok.current}
                  </p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: tok.total === 999999
                        ? "100%"
                        : `${Math.min(100, (tok.current / tok.total) * 100)}%`,
                      background: tok.color,
                    }}
                  />
                </div>
                <p className="text-[10px] font-mono mt-2" style={{ color: "#3d4f66" }}>
                  {tok.total === 999999
                    ? "Unlimited"
                    : `${tok.used} used · ${tok.current} of ${tok.total} remaining`}
                </p>
              </div>
            );
          })}
        </div>

        {/* Buy token packs button */}
        <div className="rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
          <div>
            <p className="font-medium text-sm" style={{ color: "#e8edf5" }}>
              Need more tokens?
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
              Purchase add-on packs for any token type
            </p>
          </div>
          <button
            onClick={() => setBuyPackOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0"
            style={{
              background: "linear-gradient(135deg, #00d4ff, #0099cc)",
              color: "#001a2e",
            }}>
            <ShoppingBag size={16} />
            Buy Tokens
          </button>
        </div>
      </section>

      {/* Plan comparison */}
      <section className="space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-widest"
          style={{ color: "#7a8aa0" }}>
          Plans
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isActive = currentPlan === plan.id;
            return (
              <div key={plan.id}
                className="relative rounded-2xl p-6 transition-all"
                style={isActive ? {
                  background: plan.accentBg,
                  border: `1px solid ${plan.accentBorder}`,
                  boxShadow: `0 0 30px ${plan.accent}15`,
                } : {
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                {plan.popular && !isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                    style={{
                      background: "rgba(0,212,255,0.15)",
                      border: "1px solid rgba(0,212,255,0.3)",
                      color: "#00d4ff",
                    }}>
                    Most Popular
                  </div>
                )}
                {isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase"
                    style={{
                      background: plan.accentBg,
                      border: `1px solid ${plan.accentBorder}`,
                      color: plan.accent,
                    }}>
                    Current Plan
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-bold mb-1" style={{ color: plan.accent }}>
                    {plan.name}
                  </h3>
                  <p className="text-xs font-mono mb-3" style={{ color: "#7a8aa0" }}>
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black" style={{ color: "#e8edf5" }}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm font-mono" style={{ color: "#7a8aa0" }}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                {/* Token highlights */}
                <div className="rounded-xl p-3 mb-4 space-y-2"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                  {[
                    { key: "report", label: "Report", color: "#00d4ff", Icon: FileText },
                    { key: "agent", label: "Agent", color: "#00ff88", Icon: Zap },
                    { key: "support", label: "Support", color: "#ffaa00", Icon: Headphones },
                  ].map(({ key, label, color, Icon }) => {
                    const val = plan.tokens[key as keyof typeof plan.tokens];
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon size={11} style={{ color }} />
                          <span className="text-[11px] font-mono" style={{ color: "#7a8aa0" }}>
                            {label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold" style={{ color }}>
                          {val === -1 ? "Unlimited" : `${val}/mo`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.slice(3).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs"
                      style={{ color: "#7a8aa0" }}>
                      <Check size={13} className="mt-0.5 shrink-0" style={{ color: plan.accent }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.id === "free" ? (
                  <button
                    disabled={isActive}
                    onClick={() => !isActive && setDowngradeModalOpen(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-default"
                    style={isActive ? {
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#7a8aa0",
                    } : {
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#e8edf5",
                    }}>
                    {isActive ? "Current plan" : "Downgrade"}
                  </button>
                ) : plan.id === "enterprise" ? (
                  <button
                    onClick={() => setEnterpriseOpen(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={isActive ? {
                      background: "rgba(0,255,136,0.12)",
                      border: "1px solid rgba(0,255,136,0.3)",
                      color: "#00ff88",
                    } : {
                      background: "rgba(0,255,136,0.08)",
                      border: "1px solid rgba(0,255,136,0.2)",
                      color: "#00ff88",
                    }}>
                    {isActive ? "Manage plan" : "Contact sales"}
                  </button>
                ) : (
                  <button
                    onClick={() => isActive ? null : setUpgradeOpen(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={isActive ? {
                      background: "rgba(0,212,255,0.12)",
                      border: "1px solid rgba(0,212,255,0.3)",
                      color: "#00d4ff",
                    } : {
                      background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                      color: "#001a2e",
                    }}>
                    {isActive ? "Current plan" : "Upgrade to Pro"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Cancel / restore */}
      {isPro && (
        <section>
          {billing.isCanceled ? (
            <button onClick={restoreRenewal}
              className="text-sm font-mono transition-colors"
              style={{ color: "#00d4ff" }}>
              Restore renewal
            </button>
          ) : (
            <button onClick={cancelRenewal}
              className="text-sm font-mono transition-colors"
              style={{ color: "#3d4f66" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#ff4466")}
              onMouseLeave={e => (e.currentTarget.style.color = "#3d4f66")}>
              Cancel renewal at period end
            </button>
          )}
        </section>
      )}

      {/* ─── Buy Token Packs Modal ─── */}
      <AnimatePresence>
        {buyPackOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setBuyPackOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-lg rounded-2xl overflow-hidden"
              style={{
                background: "#0d1424",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              }}>
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} style={{ color: "#00d4ff" }} />
                  <h3 className="font-bold" style={{ color: "#e8edf5" }}>
                    Buy Token Packs
                  </h3>
                </div>
                <button type="button" onClick={() => setBuyPackOpen(false)}
                  style={{ color: "#7a8aa0" }}>
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm font-mono" style={{ color: "#7a8aa0" }}>
                  Add tokens to your account instantly. Packs do not expire.
                </p>

                <div className="space-y-2.5">
                  {TOKEN_PACKS.map((pack) => (
                    <button key={pack.id} type="button"
                      onClick={() => setSelectedPack(
                        selectedPack === pack.id ? null : pack.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all"
                      style={selectedPack === pack.id ? {
                        background: pack.bg,
                        border: `1px solid ${pack.border}`,
                      } : {
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm"
                            style={{ color: "#e8edf5" }}>
                            {pack.label}
                          </span>
                          {pack.popular && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                background: "rgba(0,255,136,0.1)",
                                color: "#00ff88",
                                border: "1px solid rgba(0,255,136,0.2)",
                              }}>
                              POPULAR
                            </span>
                          )}
                          {pack.bestValue && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{
                                background: "rgba(255,255,255,0.08)",
                                color: "#e8edf5",
                                border: "1px solid rgba(255,255,255,0.15)",
                              }}>
                              BEST VALUE
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono mt-0.5"
                          style={{ color: "#7a8aa0" }}>
                          {pack.desc}
                        </p>
                      </div>
                      <span className="font-black text-lg" style={{ color: pack.color }}>
                        {pack.price}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                  <Shield size={15} style={{ color: "#7a8aa0" }} className="mt-0.5 shrink-0" />
                  <p className="text-xs font-mono" style={{ color: "#7a8aa0" }}>
                    Secure payment. No card data stored by RapiMed.
                  </p>
                </div>

                <button
                  disabled={!selectedPack}
                  onClick={() => {
                    setBuyPackOpen(false);
                    setSelectedPack(null);
                  }}
                  className="w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                    color: "#001a2e",
                  }}>
                  Continue to checkout
                </button>

                <p className="text-center text-xs font-mono" style={{ color: "#3d4f66" }}>
                  Payment integration coming soon.
                  Contact support@rapimed.ai to purchase.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Upgrade to Pro Modal ─── */}
      <AnimatePresence>
        {upgradeOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setUpgradeOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: "#0d1424",
                border: "1px solid rgba(0,212,255,0.2)",
                boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              }}>
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <Shield size={18} style={{ color: "#00d4ff" }} />
                  <h3 className="font-bold" style={{ color: "#e8edf5" }}>
                    {isPro ? "Manage Billing" : "Upgrade to Pro"}
                  </h3>
                </div>
                <button type="button" onClick={() => setUpgradeOpen(false)}
                  style={{ color: "#7a8aa0" }}>
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {!isPro && (
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-wider"
                        style={{ color: "#7a8aa0" }}>
                        Pro Plan — Total due today
                      </p>
                      <p className="text-4xl font-black mt-1" style={{ color: "#e8edf5" }}>
                        $29
                        <span className="text-lg font-mono" style={{ color: "#7a8aa0" }}>
                          /mo
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono" style={{ color: "#7a8aa0" }}>Includes</p>
                      <p className="text-xs font-mono" style={{ color: "#00d4ff" }}>30R · 100A · 50S tokens</p>
                    </div>
                  </div>
                )}
                <div className="rounded-xl p-4 space-y-2"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                  <p className="text-xs font-mono" style={{ color: "#7a8aa0" }}>
                    Payment is handled securely. You will be redirected to complete your transaction.
                  </p>
                  <div className="flex items-center gap-2 text-[11px] font-mono"
                    style={{ color: "#3d4f66" }}>
                    <Lock size={10} /> Encrypted payment processing
                  </div>
                </div>
                <button
                  onClick={() => setUpgradeOpen(false)}
                  className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                    color: "#001a2e",
                  }}>
                  <Lock size={15} />
                  {isPro ? "Open billing portal" : "Pay $29 securely"}
                </button>
                <p className="text-center text-xs font-mono" style={{ color: "#3d4f66" }}>
                  Payment integration coming soon.
                  Contact support@rapimed.ai to upgrade.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Enterprise Modal ─── */}
      <AnimatePresence>
        {enterpriseOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 backdrop-blur-sm"
              style={{ background: "rgba(0,0,0,0.7)" }}
              onClick={() => setEnterpriseOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: "#0d1424",
                border: "1px solid rgba(0,255,136,0.2)",
                boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              }}>
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="font-bold" style={{ color: "#e8edf5" }}>
                  Enterprise Plan
                </h3>
                <button type="button" onClick={() => setEnterpriseOpen(false)}
                  style={{ color: "#7a8aa0" }}>
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm leading-relaxed" style={{ color: "#7a8aa0" }}>
                  Enterprise plans are fully customized for clinics and healthcare organizations.
                  Our team will contact you to discuss volume, integrations, SLA, and pricing.
                </p>
                <a
                  href="mailto:support@rapimed.ai?subject=Enterprise%20Plan%20Inquiry"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-sm"
                  style={{
                    background: "rgba(0,255,136,0.1)",
                    border: "1px solid rgba(0,255,136,0.3)",
                    color: "#00ff88",
                  }}>
                  Contact sales team
                </a>
                <p className="text-center text-xs font-mono" style={{ color: "#3d4f66" }}>
                  support@rapimed.ai
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Downgrade confirm */}
      <AnimatePresence>
        {downgradeModalOpen && (
          <DowngradeConfirmModal
            isOpen={downgradeModalOpen}
            onClose={() => setDowngradeModalOpen(false)}
            onConfirm={handleDowngradeConfirm}
            isConfirming={downgradeConfirming}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
