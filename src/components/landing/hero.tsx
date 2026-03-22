"use client"

import Link from "next/link"
import { ArrowRight, Sparkles, FileText, Zap, Headphones } from "lucide-react"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
      style={{ background: "#0a0f1e" }}>

      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

      {/* Glow orbs */}
      <div className="absolute pointer-events-none"
        style={{
          width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)",
          top: "-200px", left: "-200px",
        }} />
      <div className="absolute pointer-events-none"
        style={{
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,255,136,0.05) 0%, transparent 70%)",
          bottom: "-100px", right: "-100px",
        }} />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, #00d4ff, transparent)"
        }} />

      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-8 text-sm font-mono"
          style={{
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.2)",
            color: "#00d4ff",
          }}>
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Medical Image Interpretation
          <ArrowRight className="h-3 w-3" />
        </div>

        {/* Heading */}
        <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl lg:text-8xl mb-8"
          style={{ color: "#e8edf5" }}>
          <span className="block">Your Medical Scans,</span>
          <span className="block mt-2">
            Explained with{" "}
            <span className="relative inline-block">
              <span className="relative z-10"
                style={{ color: "#00d4ff" }}>AI</span>
              <span className="absolute -bottom-2 left-0 right-0 h-3 rounded-full blur-sm"
                style={{ background: "rgba(0,212,255,0.3)" }} />
            </span>
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed md:text-xl"
          style={{ color: "#7a8aa0" }}>
          Upload your MRI, CT, X-ray or lab reports. Get AI-powered interpretations
          with three separate modes — Quick Analysis, Detailed Report, and General
          Medical Chat. Always encrypted, always private.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/signup"
            className="flex items-center gap-2 h-14 px-8 rounded-xl text-base font-bold transition-all"
            style={{
              background: "linear-gradient(135deg, #00d4ff, #0099cc)",
              color: "#001a2e",
              boxShadow: "0 0 40px rgba(0,212,255,0.3)",
            }}>
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#how-it-works"
            className="flex items-center gap-2 h-14 px-8 rounded-xl text-base font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e8edf5",
            }}>
            See How It Works
          </a>
        </div>

        {/* Token system preview */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { icon: FileText, label: "Report Tokens", desc: "AI image analysis", color: "#00d4ff", bg: "rgba(0,212,255,0.06)", border: "rgba(0,212,255,0.15)" },
            { icon: Zap, label: "Agent Tokens", desc: "Medical AI chat", color: "#00ff88", bg: "rgba(0,255,136,0.06)", border: "rgba(0,255,136,0.15)" },
            { icon: Headphones, label: "Support Tokens", desc: "Human support", color: "#ffaa00", bg: "rgba(255,170,0,0.06)", border: "rgba(255,170,0,0.15)" },
          ].map((t) => (
            <div key={t.label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: t.bg, border: `1px solid ${t.border}` }}>
              <t.icon className="h-4 w-4 shrink-0" style={{ color: t.color }} />
              <div className="text-left">
                <p className="text-xs font-semibold" style={{ color: "#e8edf5" }}>{t.label}</p>
                <p className="text-[10px] font-mono" style={{ color: "#7a8aa0" }}>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { value: "3", label: "AI Models Combined" },
            { value: "<60s", label: "Analysis Time" },
            { value: "256-bit", label: "Encryption" },
            { value: "24/7", label: "Support Available" },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold md:text-4xl font-mono"
                style={{ color: "#00d4ff" }}>
                {stat.value}
              </span>
              <span className="text-sm font-mono" style={{ color: "#7a8aa0" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
