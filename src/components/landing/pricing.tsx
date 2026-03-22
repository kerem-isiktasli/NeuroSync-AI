"use client"

import Link from "next/link"
import { Check, ArrowRight, FileText, Zap, Headphones } from "lucide-react"

const plans = [
  {
    name: "Free",
    description: "Start understanding your medical scans today.",
    price: "$0",
    period: "",
    tokens: { report: 3, agent: 10, support: 5 },
    features: [
      "3 report tokens / month",
      "10 agent (AI chat) tokens / month",
      "5 customer support tokens / month",
      "AI medical image analysis",
      "General medical chat",
      "Report history",
    ],
    cta: "Get Started Free",
    ctaHref: "/signup",
    popular: false,
    accent: "#7a8aa0",
    bg: "rgba(255,255,255,0.02)",
    border: "rgba(255,255,255,0.08)",
  },
  {
    name: "Pro",
    description: "For patients with regular imaging and follow-up needs.",
    price: "$29",
    period: "/month",
    tokens: { report: 30, agent: 100, support: 50 },
    features: [
      "30 report tokens / month",
      "100 agent (AI chat) tokens / month",
      "50 customer support tokens / month",
      "Priority AI model",
      "Priority support response",
      "Detailed intake analysis",
      "Full report download (PDF)",
    ],
    cta: "Start with Pro",
    ctaHref: "/signup",
    popular: true,
    accent: "#00d4ff",
    bg: "rgba(0,212,255,0.05)",
    border: "rgba(0,212,255,0.25)",
  },
  {
    name: "Enterprise",
    description: "For clinics and healthcare organizations.",
    price: "Custom",
    period: "",
    tokens: { report: -1, agent: -1, support: -1 },
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
    cta: "Contact Sales",
    ctaHref: "mailto:support@rapimed.ai?subject=Enterprise%20Inquiry",
    popular: false,
    accent: "#00ff88",
    bg: "rgba(0,255,136,0.04)",
    border: "rgba(0,255,136,0.2)",
  },
]

const TOKEN_ICONS = { report: FileText, agent: Zap, support: Headphones }
const TOKEN_COLORS = { report: "#00d4ff", agent: "#00ff88", support: "#ffaa00" }
const TOKEN_LABELS = { report: "Report", agent: "Agent", support: "Support" }

export function Pricing() {
  return (
    <section id="pricing" className="relative py-32"
      style={{ background: "#0d1424" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-20">
          <p className="text-sm font-mono uppercase tracking-widest mb-4"
            style={{ color: "#00d4ff" }}>
            Pricing
          </p>
          <h2 className="text-4xl font-bold md:text-5xl"
            style={{ color: "#e8edf5" }}>
            Simple Token-Based Pricing
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg"
            style={{ color: "#7a8aa0" }}>
            Three separate token pools — Report, Agent, and Support.
            Free forever. Upgrade when you need more.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name}
              className="relative rounded-2xl p-8 transition-all flex flex-col"
              style={{
                background: plan.bg,
                border: `1px solid ${plan.border}`,
                boxShadow: plan.popular
                  ? `0 0 40px rgba(0,212,255,0.1)` : "none",
              }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-mono font-bold uppercase"
                  style={{
                    background: "rgba(0,212,255,0.15)",
                    border: "1px solid rgba(0,212,255,0.3)",
                    color: "#00d4ff",
                  }}>
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold mb-1"
                  style={{ color: plan.accent }}>
                  {plan.name}
                </h3>
                <p className="text-sm" style={{ color: "#7a8aa0" }}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-black"
                  style={{ color: "#e8edf5" }}>
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-base font-mono ml-1"
                    style={{ color: "#7a8aa0" }}>
                    {plan.period}
                  </span>
                )}
              </div>

              {/* Token highlights */}
              <div className="rounded-xl p-4 mb-6 space-y-2"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                {(["report", "agent", "support"] as const).map((key) => {
                  const Icon = TOKEN_ICONS[key]
                  const val = plan.tokens[key]
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Icon size={11} style={{ color: TOKEN_COLORS[key] }} />
                        <span className="text-[11px] font-mono"
                          style={{ color: "#7a8aa0" }}>
                          {TOKEN_LABELS[key]}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold"
                        style={{ color: TOKEN_COLORS[key] }}>
                        {val === -1 ? "Unlimited" : `${val}/mo`}
                      </span>
                    </div>
                  )
                })}
              </div>

              <Link href={plan.ctaHref}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-bold transition-all mb-8"
                style={plan.popular ? {
                  background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                  color: "#001a2e",
                } : plan.name === "Enterprise" ? {
                  background: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.25)",
                  color: "#00ff88",
                } : {
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e8edf5",
                }}>
                {plan.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="mt-auto pt-6 space-y-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color: "#3d4f66" }}>
                  What&apos;s included
                </p>
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Check size={13} className="mt-0.5 shrink-0"
                      style={{ color: plan.accent }} />
                    <span className="text-sm" style={{ color: "#7a8aa0" }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center mt-10 text-sm font-mono"
          style={{ color: "#3d4f66" }}>
          Need more tokens? Purchase add-on packs anytime from your dashboard.
        </p>
      </div>
    </section>
  )
}
