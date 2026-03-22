"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, HeartPulse } from "lucide-react"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "rgba(10,15,30,0.85)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
      }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: "rgba(0,212,255,0.1)",
              border: "1px solid rgba(0,212,255,0.25)",
              boxShadow: "0 0 15px rgba(0,212,255,0.15)",
            }}>
            <HeartPulse className="h-5 w-5" style={{ color: "#00d4ff" }} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-none tracking-tight"
              style={{ color: "#e8edf5" }}>
              RapiMed
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] leading-none mt-0.5"
              style={{ color: "#7a8aa0" }}>
              AI Medical
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href}
              className="text-sm transition-colors font-mono"
              style={{ color: "#7a8aa0" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#00d4ff")}
              onMouseLeave={e => (e.currentTarget.style.color = "#7a8aa0")}>
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login"
            className="text-sm font-mono px-4 py-2 rounded-lg transition-all"
            style={{ color: "#7a8aa0" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e8edf5")}
            onMouseLeave={e => (e.currentTarget.style.color = "#7a8aa0")}>
            Sign In
          </Link>
          <Link href="/signup"
            className="text-sm font-semibold px-5 py-2 rounded-xl transition-all"
            style={{
              background: "linear-gradient(135deg, #00d4ff, #0099cc)",
              color: "#001a2e",
            }}>
            Get Started
          </Link>
        </div>

        <button type="button"
          className="md:hidden p-2"
          style={{ color: "#e8edf5" }}
          onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden px-6 py-5 space-y-4"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(10,15,30,0.98)",
          }}>
          {navLinks.map((link) => (
            <a key={link.label} href={link.href}
              className="block text-sm font-mono py-1"
              style={{ color: "#7a8aa0" }}
              onClick={() => setIsOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="pt-4 space-y-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Link href="/login"
              className="block text-sm font-mono py-2"
              style={{ color: "#7a8aa0" }}>
              Sign In
            </Link>
            <Link href="/signup"
              className="block text-sm font-semibold px-5 py-2.5 rounded-xl text-center"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                color: "#001a2e",
              }}>
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
