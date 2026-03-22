"use client"

import { Shield, Lock, Server, FileCheck, KeyRound, Activity } from "lucide-react"

const features = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "AES-256 for data at rest, TLS 1.3 in transit. Your medical data is never exposed.",
  },
  {
    icon: Shield,
    title: "Firebase Auth Security",
    description: "Email verification required. Google OAuth supported. All sessions token-verified server-side.",
  },
  {
    icon: Server,
    title: "Firestore Access Rules",
    description: "Users can only access their own data. Support staff require explicit patient consent to view reports.",
  },
  {
    icon: FileCheck,
    title: "Data Consent System",
    description: "Every support ticket requires a consent decision. You choose what staff can see — and can revoke it.",
  },
  {
    icon: KeyRound,
    title: "Role-Based Access",
    description: "Separate roles for patients, support staff, and admins. No cross-access without authorization.",
  },
  {
    icon: Activity,
    title: "Admin Audit Panel",
    description: "All config changes are logged with timestamp and actor. Admin panel tracks who changed what and when.",
  },
]

export function Security() {
  return (
    <section id="security" className="relative py-32"
      style={{ background: "#0a0f1e" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-mono uppercase tracking-widest mb-4"
              style={{ color: "#00d4ff" }}>
              Security
            </p>
            <h2 className="text-4xl font-bold md:text-5xl"
              style={{ color: "#e8edf5" }}>
              Your Data is Private by Design
            </h2>
            <p className="mt-6 text-lg leading-relaxed"
              style={{ color: "#7a8aa0" }}>
              Medical data deserves the highest level of protection.
              Every layer of RapiMed is built with that principle.
            </p>

            <div className="mt-10 flex items-center gap-4 rounded-2xl px-6 py-5 inline-flex"
              style={{
                background: "rgba(0,212,255,0.06)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid rgba(0,212,255,0.25)",
                }}>
                <Shield className="h-6 w-6" style={{ color: "#00d4ff" }} />
              </div>
              <div>
                <p className="font-bold" style={{ color: "#e8edf5" }}>
                  Zero Data Selling
                </p>
                <p className="text-sm font-mono" style={{ color: "#7a8aa0" }}>
                  Your data is never sold or shared
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title}
                className="rounded-xl p-5 transition-all"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}>
                <f.icon className="mb-3 h-5 w-5" style={{ color: "#00d4ff" }} />
                <h3 className="text-sm font-bold mb-1.5" style={{ color: "#e8edf5" }}>
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "#7a8aa0" }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
