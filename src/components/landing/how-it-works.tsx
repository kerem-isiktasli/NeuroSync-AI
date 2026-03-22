"use client"

import { Upload, Brain, FileText, ArrowRight } from "lucide-react"

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload Your Scan",
    description: "Upload any medical file — MRI, CT, X-ray, ultrasound, blood test, or doctor report. Supports DICOM, JPEG, PNG, and PDF formats.",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.08)",
    border: "rgba(0,212,255,0.2)",
  },
  {
    step: "02",
    icon: Brain,
    title: "AI Analyzes Your Images",
    description: "Google Gemini 2.5 Pro classifies and extracts findings from your scan. Claude then synthesizes a complete, evidence-based interpretation tailored to your symptoms.",
    color: "#00ff88",
    bg: "rgba(0,255,136,0.08)",
    border: "rgba(0,255,136,0.2)",
  },
  {
    step: "03",
    icon: FileText,
    title: "Get Your Report",
    description: "Receive a structured report with key findings, concern level, questions to ask your doctor, and a downloadable PDF — all in plain language.",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.08)",
    border: "rgba(255,170,0,0.2)",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-32"
      style={{ background: "#0a0f1e" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center mb-20">
          <p className="text-sm font-mono uppercase tracking-widest mb-4"
            style={{ color: "#00d4ff" }}>
            How It Works
          </p>
          <h2 className="text-4xl font-bold md:text-5xl"
            style={{ color: "#e8edf5" }}>
            From Upload to Insight in Under 60 Seconds
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg"
            style={{ color: "#7a8aa0" }}>
            Three steps powered by two AI models working together
          </p>
        </div>

        <div className="relative grid gap-6 md:grid-cols-3">
          {/* Connector */}
          <div className="absolute top-16 left-[20%] right-[20%] hidden h-px md:block"
            style={{ background: "rgba(0,212,255,0.15)" }} />

          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              <div className="rounded-2xl p-8 transition-all h-full"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${step.border}`,
                }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-6"
                  style={{ background: step.bg, border: `1px solid ${step.border}` }}>
                  <step.icon className="h-7 w-7" style={{ color: step.color }} />
                </div>

                <div className="text-xs font-mono uppercase tracking-widest mb-2"
                  style={{ color: step.color }}>
                  Step {step.step}
                </div>

                <h3 className="text-xl font-bold mb-3"
                  style={{ color: "#e8edf5" }}>
                  {step.title}
                </h3>

                <p className="text-sm leading-relaxed"
                  style={{ color: "#7a8aa0" }}>
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 && (
                <div className="absolute -right-4 top-16 z-10 hidden h-8 w-8 items-center justify-center rounded-full md:flex"
                  style={{
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}>
                  <ArrowRight className="h-4 w-4" style={{ color: "#00d4ff" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
