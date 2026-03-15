"use client"

import { Zap, Eye, Clock, Globe, BarChart3, Layers } from "lucide-react"

const features = [
  {
    icon: Eye,
    title: "Multi-Modal Image Analysis",
    description: "Support for X-rays, MRIs, CT scans, ultrasound, pathology slides, and dermatological images with specialized AI models for each modality.",
  },
  {
    icon: Zap,
    title: "Real-Time Processing",
    description: "Get diagnostic results in under 30 seconds. Our optimized pipeline ensures minimal wait time without compromising accuracy.",
  },
  {
    icon: BarChart3,
    title: "Confidence & Clarity",
    description: "Each analysis includes clear confidence levels and plain-language explanations so you know what to discuss with your doctor.",
  },
  {
    icon: Layers,
    title: "Evidence-Based Context",
    description: "Our AI references current medical guidelines to explain findings and possible next steps in terms you can understand.",
  },
  {
    icon: Globe,
    title: "Multi-Language Support",
    description: "Get your report interpretations in 40+ languages so you can understand your results in your preferred language.",
  },
  {
    icon: Clock,
    title: "Your Report History",
    description: "Keep all your past analyses in one place so you can revisit them and track follow-up over time.",
  },
]

export function Features() {
  return (
    <section id="features" className="relative py-32">
      {/* Background accent */}
      <div className="absolute inset-0 bg-muted/50" />

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-4">Features</p>
          <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl text-balance">
            Built for You
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Features designed to help you understand your medical scans and reports
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md"
            >
              {/* Icon */}
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>

              <h3 className="font-display text-lg font-bold text-foreground mb-3">
                {feature.title}
              </h3>

              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>

              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
