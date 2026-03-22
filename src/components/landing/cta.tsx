"use client"

import Link from "next/link"
import { ArrowRight, HeartPulse } from "lucide-react"

export function CTA() {
  return (
    <section className="relative py-32"
      style={{ background: "#0a0f1e" }}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl px-12 py-20 text-center"
          style={{
            background: "rgba(0,212,255,0.04)",
            border: "1px solid rgba(0,212,255,0.15)",
            boxShadow: "0 0 60px rgba(0,212,255,0.06)",
          }}>
          {/* Glow */}
          <div className="absolute top-0 right-0 h-[300px] w-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)",
            }} />
          <div className="absolute bottom-0 left-0 h-[200px] w-[200px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(0,255,136,0.05) 0%, transparent 70%)",
            }} />

          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, #00d4ff, transparent)",
            }} />

          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  boxShadow: "0 0 20px rgba(0,212,255,0.2)",
                }}>
                <HeartPulse className="h-7 w-7" style={{ color: "#00d4ff" }} />
              </div>
            </div>

            <h2 className="text-4xl font-bold md:text-5xl mb-6"
              style={{ color: "#e8edf5" }}>
              Ready to Understand Your Medical Reports?
            </h2>
            <p className="mx-auto max-w-xl text-lg leading-relaxed mb-10"
              style={{ color: "#7a8aa0" }}>
              Upload your scans, get clear AI interpretations, and know exactly
              what questions to ask your doctor — all in under 60 seconds.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup"
                className="flex items-center gap-2 h-14 px-8 rounded-xl text-base font-bold transition-all"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                  color: "#001a2e",
                  boxShadow: "0 0 30px rgba(0,212,255,0.3)",
                }}>
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login"
                className="flex items-center gap-2 h-14 px-8 rounded-xl text-base font-medium transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e8edf5",
                }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
