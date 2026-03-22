"use client"

import { Zap, Eye, MessageSquare, Shield, BarChart3, Headphones } from "lucide-react"

const features = [
  {
    icon: Eye,
    title: "Multi-Modal Image Analysis",
    description: "MRI, CT, X-ray, ultrasound, blood tests, doctor reports — all handled by specialized AI models for each modality.",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.08)",
  },
  {
    icon: Zap,
    title: "Quick & Detailed Modes",
    description: "Quick Analysis uses only your saved profile. Detailed Report uses your full symptom intake for a personalized, clinically-relevant interpretation.",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.08)",
  },
  {
    icon: MessageSquare,
    title: "General Medical Chat",
    description: "Ask any medical question — no report needed. Get clear answers about symptoms, conditions, or when to seek care, powered by Claude.",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.08)",
  },
  {
    icon: BarChart3,
    title: "Concern Level Scoring",
    description: "Every report includes a Low / Moderate / High / Urgent concern level so you know at a glance how to prioritize follow-up.",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.08)",
  },
  {
    icon: Shield,
    title: "Data Consent Controls",
    description: "You decide what the support team can see. Explicit consent required before any staff member can view your medical data.",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.08)",
  },
  {
    icon: Headphones,
    title: "Human Support Team",
    description: "Dedicated medical and account support staff with real-time chat, ticket tracking, and assignment locking so one agent handles your case.",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.08)",
  },
]

export function Features() {
  return (
    <section id="features" className="relative py-32"
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
            Features
          </p>
          <h2 className="text-4xl font-bold md:text-5xl"
            style={{ color: "#e8edf5" }}>
            Built Around You
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg"
            style={{ color: "#7a8aa0" }}>
            Every feature designed to help you understand your results and get the right care
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title}
              className="group rounded-2xl p-7 transition-all"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.border = `1px solid ${f.color}30`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,255,255,0.07)"
              }}>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: f.bg }}>
                <f.icon className="h-6 w-6" style={{ color: f.color }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: "#e8edf5" }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#7a8aa0" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
