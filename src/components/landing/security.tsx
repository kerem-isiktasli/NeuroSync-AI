"use client"

import { Shield, Lock, Server, FileCheck, KeyRound, Activity } from "lucide-react"

const securityFeatures = [
  {
    icon: Shield,
    title: "HIPAA Compliant",
    description: "Full compliance with Health Insurance Portability and Accountability Act regulations for your data protection.",
  },
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "AES-256 encryption for data at rest and TLS 1.3 for data in transit. Your medical data is never exposed.",
  },
  {
    icon: Server,
    title: "SOC 2 Type II Certified",
    description: "Annual third-party audits verify our security controls meet the highest industry standards.",
  },
  {
    icon: FileCheck,
    title: "GDPR Ready",
    description: "Built-in data governance tools ensure compliance with European data protection regulations.",
  },
  {
    icon: KeyRound,
    title: "Role-Based Access",
    description: "Granular permission controls ensure only you can access sensitive your data.",
  },
  {
    icon: Activity,
    title: "Audit Logging",
    description: "Comprehensive activity logs track every access and modification for regulatory compliance and accountability.",
  },
]

export function Security() {
  return (
    <section id="security" className="relative py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left side */}
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary mb-4">Security</p>
            <h2 className="font-display text-4xl font-bold text-foreground md:text-5xl text-balance">
              Enterprise-Grade Security for Healthcare
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Your data security is a priority. Our platform is built with healthcare-grade security and compliance in mind.
            </p>

            {/* Trust badge */}
            <div className="mt-10 inline-flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] px-6 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-foreground">Zero Data Breaches</p>
                <p className="text-sm text-muted-foreground">Since platform launch</p>
              </div>
            </div>
          </div>

          {/* Right side - Security features grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {securityFeatures.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-md"
              >
                <feature.icon className="mb-4 h-5 w-5 text-primary" />
                <h3 className="font-display text-sm font-bold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
