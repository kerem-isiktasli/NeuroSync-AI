"use client"

import Link from "next/link"
import { HeartPulse } from "lucide-react"

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Security", href: "#security" },
    { label: "How It Works", href: "#how-it-works" },
  ],
  Account: [
    { label: "Sign In", href: "/login" },
    { label: "Create Account", href: "/signup" },
    { label: "Dashboard", href: "/dashboard" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Medical Disclaimer", href: "#" },
    { label: "Data Deletion", href: "mailto:support@rapimed.ai?subject=Data%20Deletion%20Request" },
  ],
}

export function Footer() {
  return (
    <footer style={{
      background: "#0d1424",
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid rgba(0,212,255,0.25)",
                }}>
                <HeartPulse className="h-5 w-5" style={{ color: "#00d4ff" }} />
              </div>
              <div>
                <span className="text-base font-bold block leading-none"
                  style={{ color: "#e8edf5" }}>
                  RapiMed
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest leading-none"
                  style={{ color: "#7a8aa0" }}>
                  AI Medical
                </span>
              </div>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed"
              style={{ color: "#7a8aa0" }}>
              AI-powered medical image interpretation. Understand your results
              in plain language, always encrypted, always private.
            </p>
            <p className="mt-4 text-xs font-mono"
              style={{ color: "#3d4f66" }}>
              support@rapimed.ai
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-mono uppercase tracking-widest mb-4"
                style={{ color: "#00d4ff" }}>
                {category}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}
                      className="text-sm font-mono transition-colors"
                      style={{ color: "#7a8aa0" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#e8edf5")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#7a8aa0")}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 flex flex-col items-center justify-between gap-4 md:flex-row"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-mono"
            style={{ color: "#3d4f66" }}>
            © {new Date().getFullYear()} RapiMed. All rights reserved.
          </p>
          <p className="text-xs font-mono"
            style={{ color: "#3d4f66" }}>
            For informational use only. Not a substitute for professional medical advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
