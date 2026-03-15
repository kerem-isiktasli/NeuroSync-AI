"use client"

import Link from "next/link"
import { Check, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const plans = [
  {
    name: "Starter",
    description: "For individual practitioners getting started with AI-assisted diagnostics.",
    price: "$49",
    period: "/month",
    features: [
      "100 image analyses per month",
      "Basic diagnostic reports",
      "Treatment recommendations",
      "Email support",
      "1 user account",
      "Standard processing speed",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Professional",
    description: "For power users who need more analyses and exports.",
    price: "$149",
    period: "/month",
    features: [
      "Unlimited image analyses",
      "Advanced diagnostic reports",
      "Priority treatment synthesis",
      "24/7 priority support",
      "Up to 10 user accounts",
      "Real-time processing",
      "Case history & tracking",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For custom or team use. Contact us for options.",
    price: "Custom",
    period: "",
    features: [
      "Unlimited everything",
      "Custom AI model training",
      "Dedicated account manager",
      "On-premise deployment option",
      "Unlimited user accounts",
      "Custom integrations",
      "SLA guarantee",
      "White-label solution",
    ],
    cta: "Contact Sales",
    popular: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="relative py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-4">Pricing</p>
          <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl text-balance">
            Plans for Every Practice
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Start with a 14-day free trial. No credit card required. Scale as your practice grows.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 transition-all duration-300 ${
                plan.popular
                  ? "border-primary/50 bg-card shadow-[0_0_60px_-15px_hsl(348,70%,33%,0.3)]"
                  : "border-border/50 bg-card hover:border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="font-display text-5xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <Button
                className={`w-full h-12 rounded-xl text-sm font-medium gap-2 ${
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
                asChild
              >
                <Link href="/signup">
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <div className="mt-8 border-t border-border/50 pt-8">
                <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {"What's included"}
                </p>
                <ul className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
