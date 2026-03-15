"use client"

import { Upload, Brain, FileText, ArrowRight } from "lucide-react"

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload Medical Image",
    description: "Upload any medical imaging file - X-rays, MRIs, CT scans, pathology slides, and more. Our platform supports all standard medical imaging formats.",
    color: "from-primary/20 to-primary/5",
  },
  {
    step: "02",
    icon: Brain,
    title: "AI-Powered Diagnosis",
    description: "Google Vertex AI analyzes the image with state-of-the-art deep learning models trained on millions of medical cases, delivering accurate diagnostic insights.",
    color: "from-primary/15 to-primary/5",
  },
  {
    step: "03",
    icon: FileText,
    title: "Treatment Recommendations",
    description: "Claude AI processes the diagnosis and cross-references the latest medical literature to generate comprehensive, evidence-based treatment recommendations.",
    color: "from-primary/10 to-primary/5",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-4">How It Works</p>
          <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl text-balance">
            From Image to Treatment in Seconds
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Three simple steps to understand your medical scans
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Connector line */}
          <div className="absolute top-24 left-[16.6%] right-[16.6%] hidden h-px bg-border md:block" />

          {steps.map((step, index) => (
            <div key={step.step} className="relative group">
              <div className="relative rounded-2xl border border-border bg-card p-8 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md">
                {/* Step number */}
                <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color}`}>
                  <step.icon className="h-7 w-7 text-primary" />
                </div>

                <div className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-primary/60">
                  Step {step.step}
                </div>

                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>

                {index < steps.length - 1 && (
                  <div className="absolute -right-4 top-24 z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm md:flex">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
