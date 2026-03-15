"use client"

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/[0.06] blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-primary/[0.04] blur-[100px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/[0.02] blur-[80px]" />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(122,27,46,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(122,27,46,0.04)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
        {/* Badge */}
        <div className="animate-slide-up mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-2 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          <span>Understand Your Medical Reports</span>
          <ArrowRight className="h-3 w-3" />
        </div>

        {/* Heading */}
        <h1 className="animate-slide-up font-display text-5xl font-bold leading-tight tracking-tight text-foreground md:text-7xl lg:text-8xl" style={{ animationDelay: "0.1s" }}>
          <span className="text-balance block">
            Your Medical Reports,
          </span>
          <span className="text-balance block mt-2">
            Explained with{" "}
            <span className="relative">
              <span className="relative z-10 text-primary">AI</span>
              <span className="absolute -bottom-2 left-0 right-0 h-3 bg-primary/20 rounded-full blur-sm" />
            </span>
          </span>
        </h1>

        {/* Subtitle */}
        <p className="animate-slide-up mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl" style={{ animationDelay: "0.2s" }}>
          Upload your medical images or reports. Get clear, personal interpretations and know what to ask your doctor.
        </p>

        {/* CTAs */}
        <div className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.3s" }}>
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-base gap-2 rounded-xl" asChild>
            <Link href="/signup">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-xl border-border bg-transparent text-foreground hover:bg-muted" asChild>
            <Link href="#how-it-works">
              See How It Works
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="animate-slide-up mt-20 grid grid-cols-2 gap-8 md:grid-cols-4" style={{ animationDelay: "0.4s" }}>
          {[
            { value: "99.2%", label: "Diagnostic Accuracy" },
            { value: "<30s", label: "Analysis Time" },
            { value: "50K+", label: "Reports Interpreted" },
            { value: "HIPAA", label: "Compliant" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="font-display text-3xl font-bold text-foreground md:text-4xl">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
