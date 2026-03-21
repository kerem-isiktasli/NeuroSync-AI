"use client";

import React, { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  Settings,
  ToggleLeft,
  Save,
  ArrowLeft,
  Activity,
  Shield,
  AlertTriangle,
  Users,
  FileText,
  Trash2,
  Ban,
  RefreshCw,
  Coins,
  Headphones,
  ShieldOff,
} from "lucide-react";
import Link from "next/link";

type UserRecord = {
  uid: string;
  email: string;
  displayName?: string;
  createdAt: string;
  reportCount: number;
  disabled: boolean;
};

type ReportRecord = {
  reportId: string;
  userId: string;
  userEmail?: string;
  title: string;
  status: string;
  concernLevel: string;
  createdAt: string;
  modality: string;
};

type CreditRecord = {
  uid: string;
  email: string;
  plan: string;
  reportTokens: number;
  agentTokens: number;
  supportTokens: number;
  reportTokensTotal: number;
  agentTokensTotal: number;
  supportTokensTotal: number;
  updatedAt: string;
  hasDoc?: boolean;
};

type SupportTicket = {
  ticketId: string;
  patientEmail: string;
  subject: string;
  category: string;
  status: string;
  assignedTo: string | null;
  assignedEmail: string | null;
  dataConsent: boolean;
  supportUnread: number;
  patientUnread: number;
  createdAt: string;
  updatedAt: string;
};

type PresenceRecord = {
  uid: string;
  email: string;
  online: boolean;
  typing: boolean;
  activeTicketId: string | null;
  lastSeen: string;
};

type SupportMessage = {
  messageId: string;
  senderRole: string;
  senderEmail: string;
  text: string;
  attachments: Array<{ url: string; name: string }>;
  createdAt: string;
};

type Config = {
  vertexModel?: string;
  vertexFallbackModel?: string;
  anthropicModel?: string;
  ocrEnabled?: boolean;
  literatureEnabled?: boolean;
  fusionEnabled?: boolean;
  maxImages?: number;
  maxImageBytes?: number;
  classificationConfidenceThreshold?: number;
  promptVersionKey?: string;
  schemaVersion?: string;
  updatedAt?: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Partial<Config>>({});

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"config" | "users" | "reports" | "credits" | "support">("config");
  const [usersLoading, setUsersLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [creditsList, setCreditsList] = useState<CreditRecord[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [editingCredit, setEditingCredit] = useState<{
    uid: string;
    email: string;
    reportTokens: number;
    agentTokens: number;
    supportTokens: number;
  } | null>(null);
  const [newReportTokens, setNewReportTokens] = useState("");
  const [newAgentTokens, setNewAgentTokens] = useState("");
  const [newSupportTokens, setNewSupportTokens] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportPresence, setSupportPresence] = useState<PresenceRecord[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportActiveTicket, setSupportActiveTicket] = useState<SupportTicket | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportMsgLoading, setSupportMsgLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const token = await user.getIdToken(true);
        if (!token) {
          router.replace("/login");
          return;
        }
        const res = await fetch("/api/admin/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.admin) {
          router.replace("/dashboard");
          return;
        }
        setIsAdmin(true);
        const configRes = await fetch("/api/admin/config", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const configData = await configRes.json();
        setConfig(configData.config || {});
        setUpdates(configData.config || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to verify admin");
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user || !isAdmin) return;
    setSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setConfig(data.config);
      setUpdates(data.config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const toggleUserDisabled = async (uid: string, currentlyDisabled: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken(true);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        uid,
        disabled: !currentlyDisabled,
      }),
    });
    await loadUsers();
  };

  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setReportsLoading(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm("Delete this report permanently?")) return;
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken(true);
    await fetch(`/api/admin/reports?reportId=${encodeURIComponent(reportId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadReports();
  };

  const loadCredits = async () => {
    setCreditsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCreditsList(data.credits || []);
      }
    } catch (err) {
      console.error("Failed to load credits:", err);
    } finally {
      setCreditsLoading(false);
    }
  };

  const loadSupport = async () => {
    setSupportLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken(true);
      const [ticketsRes, presenceRes] = await Promise.all([
        fetch("/api/support/tickets", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/support/presence", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (ticketsRes.ok) {
        const d = (await ticketsRes.json()) as { tickets?: SupportTicket[] };
        setSupportTickets(d.tickets || []);
      }
      if (presenceRes.ok) {
        const d = (await presenceRes.json()) as { presence?: PresenceRecord[] };
        setSupportPresence(d.presence || []);
      }
    } finally {
      setSupportLoading(false);
    }
  };

  const loadSupportMessages = async (ticketId: string) => {
    setSupportMsgLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken(true);
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = (await res.json()) as { messages?: SupportMessage[] };
        setSupportMessages(d.messages || []);
      }
    } finally {
      setSupportMsgLoading(false);
    }
  };

  const saveCredit = async () => {
    if (!editingCredit) return;
    const reportTokens = parseInt(newReportTokens, 10);
    const agentTokens = parseInt(newAgentTokens, 10);
    const supportTokens = parseInt(newSupportTokens, 10);
    if (
      Number.isNaN(reportTokens) ||
      Number.isNaN(agentTokens) ||
      Number.isNaN(supportTokens) ||
      reportTokens < 0 ||
      agentTokens < 0 ||
      supportTokens < 0
    ) {
      return;
    }
    setCreditSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken(true);
      const res = await fetch("/api/admin/credits", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: editingCredit.uid,
          reportTokens,
          agentTokens,
          supportTokens,
          note: creditNote,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(typeof errData.error === "string" ? errData.error : "Failed to save credits");
        return;
      }
      setEditingCredit(null);
      setNewReportTokens("");
      setNewAgentTokens("");
      setNewSupportTokens("");
      setCreditNote("");
      await loadCredits();
    } finally {
      setCreditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f1e" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
              style={{
                borderTopColor: "#00d4ff",
                boxShadow: "0 0 20px rgba(0,212,255,0.3)",
              }}
            />
            <div
              className="absolute inset-3 rounded-full"
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
              }}
            />
            <Shield className="absolute inset-0 m-auto w-5 h-5 text-[#00d4ff]" />
          </div>
          <p className="text-sm font-mono tracking-wider" style={{ color: "#7a8aa0" }}>
            VERIFYING ACCESS...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const inputBaseClass =
    "w-full px-4 py-2.5 rounded-xl text-sm font-mono text-[#e8edf5] transition-all outline-none focus:border-[rgba(0,212,255,0.4)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.08)]";
  const inputBaseStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;

  return (
    <div className="min-h-screen text-[#e8edf5] relative overflow-hidden" style={{ background: "#0a0f1e" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
        linear-gradient(rgba(0,212,255,0.03) 1px, 
          transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,0.03) 
          1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="fixed top-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent, " + "#00d4ff, transparent)",
        }}
      />
      <div className="relative z-10 p-6 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 rounded-lg transition-all hover:bg-white/5 text-[#7a8aa0] hover:text-[#00d4ff]"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    border: "1px solid rgba(0,212,255,0.3)",
                    boxShadow: "0 0 20px rgba(0,212,255,0.15)",
                  }}
                >
                  <Shield className="w-5 h-5 text-[#00d4ff]" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#e8edf5]">Admin Control Panel</h1>
                <p className="text-xs text-[#7a8aa0] font-mono mt-0.5">RAPIMED OPERATIONS · RESTRICTED ACCESS</p>
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
            style={{
              background: "rgba(0,255,136,0.08)",
              border: "1px solid rgba(0,255,136,0.2)",
              color: "#00ff88",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            SYSTEM ONLINE
          </div>
        </div>

        <div
          className="flex gap-1 mb-6 p-1 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            { id: "config" as const, label: "Configuration", icon: Settings },
            { id: "users" as const, label: "Users", icon: Users },
            { id: "reports" as const, label: "Reports", icon: FileText },
            { id: "credits" as const, label: "Credits", icon: Coins },
            { id: "support" as const, label: "Support", icon: Headphones },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                if (id === "users" && users.length === 0) void loadUsers();
                if (id === "reports" && reports.length === 0) void loadReports();
                if (id === "credits" && creditsList.length === 0) void loadCredits();
                if (id === "support") void loadSupport();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={
                activeTab === id
                  ? {
                      background: "rgba(0,212,255,0.12)",
                      border: "1px solid rgba(0,212,255,0.25)",
                      color: "#00d4ff",
                      boxShadow: "0 0 20px rgba(0,212,255,0.1)",
                    }
                  : {
                      border: "1px solid transparent",
                      color: "#7a8aa0",
                    }
              }
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-xl flex items-center gap-3 text-sm"
            style={{
              background: "rgba(255,68,102,0.08)",
              border: "1px solid rgba(255,68,102,0.25)",
              color: "#ff4466",
            }}
          >
            <AlertTriangle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-6">
            <div
              className="rounded-2xl p-6 mb-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(10px)",
              }}
            >
              <h2
                className="text-sm font-semibold uppercase tracking-widest mb-5 flex items-center gap-2"
                style={{ color: "#00d4ff" }}
              >
                <span className="w-0.5 h-4 rounded-full bg-[#00d4ff]" />
                <Settings size={14} />
                AI Providers
              </h2>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: "#7a8aa0" }}>
                    Vertex model
                  </label>
                  <input
                    type="text"
                    value={updates.vertexModel ?? config?.vertexModel ?? ""}
                    onChange={(e) => setUpdates((u) => ({ ...u, vertexModel: e.target.value }))}
                    className={inputBaseClass}
                    style={inputBaseStyle}
                    placeholder="gemini-2.5-flash"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: "#7a8aa0" }}>
                    Vertex fallback model
                  </label>
                  <input
                    type="text"
                    value={updates.vertexFallbackModel ?? config?.vertexFallbackModel ?? ""}
                    onChange={(e) => setUpdates((u) => ({ ...u, vertexFallbackModel: e.target.value }))}
                    className={inputBaseClass}
                    style={inputBaseStyle}
                    placeholder="gemini-2.5-flash"
                  />
                  <p className="text-[10px] font-mono mt-1" style={{ color: "#3d4f66" }}>
                    Overrides VERTEX_FALLBACK_MODEL in .env.local
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: "#7a8aa0" }}>
                    Anthropic model
                  </label>
                  <input
                    type="text"
                    value={updates.anthropicModel ?? config?.anthropicModel ?? ""}
                    onChange={(e) => setUpdates((u) => ({ ...u, anthropicModel: e.target.value }))}
                    className={inputBaseClass}
                    style={inputBaseStyle}
                    placeholder="claude-sonnet-4-6"
                  />
                  <p className="text-[10px] font-mono mt-1" style={{ color: "#3d4f66" }}>
                    Overrides ANTHROPIC_MODEL in .env.local
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl p-6 mb-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(10px)",
              }}
            >
              <h2
                className="text-sm font-semibold uppercase tracking-widest mb-5 flex items-center gap-2"
                style={{ color: "#00d4ff" }}
              >
                <span className="w-0.5 h-4 rounded-full bg-[#00d4ff]" />
                <ToggleLeft size={14} />
                Feature flags
              </h2>
              <div className="space-y-2">
                {[
                  { key: "ocrEnabled" as const, label: "OCR (report screenshot extraction)" },
                  { key: "literatureEnabled" as const, label: "Literature search" },
                  { key: "fusionEnabled" as const, label: "Report fusion (image vs official report)" },
                ].map(({ key, label }) => {
                  const value = updates[key] ?? config?.[key] ?? true;
                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-4 cursor-pointer py-3 px-4 rounded-xl transition-colors hover:bg-white/[0.03]"
                    >
                      <div>
                        <span className="text-sm text-[#e8edf5]">{label}</span>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={value}
                          onChange={(e) => setUpdates((u) => ({ ...u, [key]: e.target.checked }))}
                        />
                        <div
                          className="w-11 h-6 rounded-full transition-all duration-200 relative pointer-events-none"
                          style={{
                            background: value ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.08)",
                            border: value ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <div
                            className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200"
                            style={{
                              background: value ? "#00d4ff" : "#3d4f66",
                              left: value ? "calc(100% - 1.375rem)" : "0.125rem",
                              boxShadow: value ? "0 0 8px rgba(0,212,255,0.6)" : "none",
                            }}
                          />
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-2xl p-6 mb-4"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(10px)",
              }}
            >
              <h2
                className="text-sm font-semibold uppercase tracking-widest mb-5 flex items-center gap-2"
                style={{ color: "#00d4ff" }}
              >
                <span className="w-0.5 h-4 rounded-full bg-[#00d4ff]" />
                <Activity size={14} />
                Limits & thresholds
              </h2>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: "#7a8aa0" }}>
                    Max images per request
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={updates.maxImages ?? config?.maxImages ?? 50}
                    onChange={(e) => setUpdates((u) => ({ ...u, maxImages: parseInt(e.target.value, 10) || 50 }))}
                    className={inputBaseClass}
                    style={inputBaseStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: "#7a8aa0" }}>
                    Classification confidence threshold (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={updates.classificationConfidenceThreshold ?? config?.classificationConfidenceThreshold ?? 40}
                    onChange={(e) =>
                      setUpdates((u) => ({
                        ...u,
                        classificationConfidenceThreshold: parseInt(e.target.value, 10) || 40,
                      }))
                    }
                    className={inputBaseClass}
                    style={inputBaseStyle}
                  />
                </div>
              </div>
            </div>

            {config?.updatedAt && (
              <p className="text-xs font-mono" style={{ color: "#3d4f66" }}>
                Last updated: {String(config.updatedAt)}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: saving ? "rgba(0,212,255,0.1)" : "linear-gradient(135deg, #00d4ff, #0099cc)",
                border: "1px solid rgba(0,212,255,0.4)",
                color: saving ? "#00d4ff" : "#001a2e",
                boxShadow: saving ? "none" : "0 0 30px rgba(0,212,255,0.25)",
              }}
            >
              {saving ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Configuration
                </>
              )}
            </button>

            {saveSuccess && (
              <div
                className="mt-3 px-4 py-3 rounded-xl text-xs font-mono text-center"
                style={{
                  background: "rgba(0,255,136,0.08)",
                  border: "1px solid rgba(0,255,136,0.2)",
                  color: "#00ff88",
                }}
              >
                ✓ Configuration saved and active within 10 seconds
              </div>
            )}

            <p className="mt-8 text-center text-xs font-mono" style={{ color: "#3d4f66" }}>
              CONFIGURATION STORED IN FIRESTORE · APPLIED AT RUNTIME · SECRETS MANAGED VIA ENV ONLY
            </p>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#e8edf5] flex items-center">
                All Users
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs font-mono"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    color: "#00d4ff",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}
                >
                  {users.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => void loadUsers()}
                disabled={usersLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#7a8aa0",
                }}
              >
                <RefreshCw size={13} className={usersLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {usersLoading ? (
              <div className="text-center py-8 text-sm font-mono" style={{ color: "#7a8aa0" }}>
                Loading users...
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.uid}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl transition-all hover:bg-white/[0.03] cursor-default"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
                        style={{
                          background: "rgba(0,212,255,0.1)",
                          color: "#00d4ff",
                          border: "1px solid rgba(0,212,255,0.2)",
                        }}
                      >
                        {u.email ? u.email[0].toUpperCase() : "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-[#e8edf5]">{u.email}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
                          {u.reportCount} reports ·{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          {u.disabled && <span style={{ color: "#ff4466" }}> · DISABLED</span>}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleUserDisabled(u.uid, u.disabled)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5"
                      style={
                        u.disabled
                          ? {
                              background: "rgba(0,255,136,0.08)",
                              border: "1px solid rgba(0,255,136,0.25)",
                              color: "#00ff88",
                            }
                          : {
                              background: "rgba(255,68,102,0.08)",
                              border: "1px solid rgba(255,68,102,0.25)",
                              color: "#ff4466",
                            }
                      }
                    >
                      <Ban size={11} />
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                  </div>
                ))}
                {users.length === 0 && !usersLoading && (
                  <p className="text-center py-8 text-sm font-mono" style={{ color: "#7a8aa0" }}>
                    No users found
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#e8edf5] flex items-center">
                All Reports
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs font-mono"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    color: "#00d4ff",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}
                >
                  {reports.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => void loadReports()}
                disabled={reportsLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#7a8aa0",
                }}
              >
                <RefreshCw size={13} className={reportsLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {reportsLoading ? (
              <div className="text-center py-8 text-sm font-mono" style={{ color: "#7a8aa0" }}>
                Loading reports...
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <div
                    key={report.reportId}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl transition-all hover:bg-white/[0.03]"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-[#e8edf5]">{report.title || "Untitled Report"}</p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
                        {report.modality || "—"} · {report.status} ·{" "}
                        {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "—"}
                      </p>
                      {report.userEmail && (
                        <p className="text-xs font-mono mt-0.5" style={{ color: "#3d4f66" }}>
                          {report.userEmail}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={
                          report.concernLevel === "urgent-review"
                            ? {
                                background: "rgba(255,68,102,0.12)",
                                color: "#ff4466",
                                border: "1px solid rgba(255,68,102,0.3)",
                                boxShadow: "0 0 8px rgba(255,68,102,0.2)",
                              }
                            : report.concernLevel === "high"
                              ? {
                                  background: "rgba(255,170,0,0.12)",
                                  color: "#ffaa00",
                                  border: "1px solid rgba(255,170,0,0.3)",
                                }
                              : report.concernLevel === "moderate"
                                ? {
                                    background: "rgba(255,170,0,0.1)",
                                    color: "#ffaa00",
                                    border: "1px solid rgba(255,170,0,0.25)",
                                  }
                                : {
                                    background: "rgba(0,255,136,0.08)",
                                    color: "#00ff88",
                                    border: "1px solid rgba(0,255,136,0.2)",
                                  }
                        }
                      >
                        {report.concernLevel || "low"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void deleteReport(report.reportId)}
                        className="p-2 rounded-lg transition-all"
                        style={{
                          background: "rgba(255,68,102,0.08)",
                          border: "1px solid rgba(255,68,102,0.2)",
                          color: "#ff4466",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && !reportsLoading && (
                  <p className="text-center py-8 text-sm font-mono" style={{ color: "#7a8aa0" }}>
                    No reports found
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "credits" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2
                className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2"
                style={{ color: "#00d4ff" }}
              >
                <span className="w-0.5 h-4 rounded-full bg-[#00d4ff]" />
                <Coins size={14} />
                USER CREDITS
                <span
                  className="ml-2 px-2 py-0.5 rounded-full text-xs font-mono"
                  style={{
                    background: "rgba(0,212,255,0.1)",
                    color: "#00d4ff",
                    border: "1px solid rgba(0,212,255,0.2)",
                  }}
                >
                  {creditsList.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => void loadCredits()}
                disabled={creditsLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#7a8aa0",
                }}
              >
                <RefreshCw size={13} className={creditsLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {editingCredit && (
              <div
                className="p-5 rounded-2xl space-y-3"
                style={{
                  background: "rgba(0,212,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.2)",
                }}
              >
                <p className="text-sm font-mono" style={{ color: "#e8edf5" }}>
                  Editing: <span style={{ color: "#00d4ff" }}>{editingCredit.email}</span>
                </p>
                <div>
                  <label
                    className="block text-[10px] font-mono uppercase tracking-wider mb-1"
                    style={{ color: "#00d4ff" }}
                  >
                    Report Tokens
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newReportTokens}
                    onChange={(e) => setNewReportTokens(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl text-sm font-mono outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(0,212,255,0.3)",
                      color: "#e8edf5",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-[10px] font-mono uppercase tracking-wider mb-1"
                    style={{ color: "#00ff88" }}
                  >
                    Agent Tokens
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newAgentTokens}
                    onChange={(e) => setNewAgentTokens(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl text-sm font-mono outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(0,255,136,0.3)",
                      color: "#e8edf5",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-[10px] font-mono uppercase tracking-wider mb-1"
                    style={{ color: "#ffaa00" }}
                  >
                    Support Tokens
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newSupportTokens}
                    onChange={(e) => setNewSupportTokens(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl text-sm font-mono outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,170,0,0.3)",
                      color: "#e8edf5",
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="Note (optional, e.g. 'Test grant')"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-mono outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e8edf5",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveCredit()}
                    disabled={
                      creditSaving ||
                      !newReportTokens ||
                      !newAgentTokens ||
                      !newSupportTokens
                    }
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                    style={{
                      background: "linear-gradient(135deg, #00d4ff, #0099cc)",
                      color: "#001a2e",
                    }}
                  >
                    {creditSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCredit(null);
                      setNewReportTokens("");
                      setNewAgentTokens("");
                      setNewSupportTokens("");
                      setCreditNote("");
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#7a8aa0",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {creditsLoading ? (
              <div className="text-center py-8 text-xs font-mono" style={{ color: "#7a8aa0" }}>
                Loading credits...
              </div>
            ) : (
              <div className="space-y-2">
                {creditsList.map((c) => (
                  <div
                    key={c.uid}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl transition-all hover:bg-white/[0.03]"
                    style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px]"
                        style={{
                          background:
                            c.reportTokens + c.agentTokens + c.supportTokens <= 2
                              ? "rgba(255,68,102,0.1)"
                              : "rgba(0,212,255,0.1)",
                          color:
                            c.reportTokens + c.agentTokens + c.supportTokens <= 2 ? "#ff4466" : "#00d4ff",
                          border:
                            c.reportTokens + c.agentTokens + c.supportTokens <= 2
                              ? "1px solid rgba(255,68,102,0.2)"
                              : "1px solid rgba(0,212,255,0.2)",
                        }}
                      >
                        Σ
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#e8edf5" }}>
                          {c.email || c.uid}
                        </p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
                          <span style={{ color: "#00d4ff" }}>{c.reportTokens}R</span>
                          {" · "}
                          <span style={{ color: "#00ff88" }}>{c.agentTokens}A</span>
                          {" · "}
                          <span style={{ color: "#ffaa00" }}>{c.supportTokens}S</span>
                          {" · "}
                          {c.plan}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCredit({
                          uid: c.uid,
                          email: c.email || c.uid,
                          reportTokens: c.reportTokens,
                          agentTokens: c.agentTokens,
                          supportTokens: c.supportTokens,
                        });
                        setNewReportTokens(String(c.reportTokens));
                        setNewAgentTokens(String(c.agentTokens));
                        setNewSupportTokens(String(c.supportTokens));
                        setCreditNote("");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
                      style={{
                        background: "rgba(0,212,255,0.08)",
                        border: "1px solid rgba(0,212,255,0.25)",
                        color: "#00d4ff",
                      }}
                    >
                      <Coins size={11} />
                      Edit
                    </button>
                  </div>
                ))}
                {creditsList.length === 0 && !creditsLoading && (
                  <p className="text-center py-8 text-xs font-mono" style={{ color: "#3d4f66" }}>
                    No credit records yet. Users appear here after their first login.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "support" && (
          <div className="space-y-6">
            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <h2
                className="text-xs font-mono uppercase tracking-widest mb-4 flex items-center gap-2"
                style={{ color: "#00d4ff" }}
              >
                <span className="w-0.5 h-4 rounded-full bg-[#00d4ff]" />
                SUPPORT EMPLOYEES ({supportPresence.length})
              </h2>
              {supportPresence.length === 0 ? (
                <p className="text-xs font-mono" style={{ color: "#3d4f66" }}>
                  No support employees online
                </p>
              ) : (
                <div className="space-y-2">
                  {supportPresence.map((p) => (
                    <div
                      key={p.uid}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div className="relative">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                          style={{
                            background: p.online ? "rgba(0,255,136,0.1)" : "rgba(255,255,255,0.04)",
                            color: p.online ? "#00ff88" : "#3d4f66",
                            border: p.online ? "1px solid rgba(0,255,136,0.2)" : "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          {(p.email?.[0] ?? "?").toUpperCase()}
                        </div>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                          style={{
                            background: p.online ? "#00ff88" : "#3d4f66",
                            borderColor: "#0a0f1e",
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#e8edf5" }}>
                          {p.email}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: "#7a8aa0" }}>
                          {p.online
                            ? p.typing
                              ? "✎ Typing..."
                              : p.activeTicketId
                                ? `Active on ticket`
                                : "Online — idle"
                            : `Last seen ${new Date(p.lastSeen).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                        </p>
                      </div>
                      <div
                        className="text-[10px] font-mono px-2 py-1 rounded-full"
                        style={
                          p.online
                            ? {
                                background: "rgba(0,255,136,0.08)",
                                color: "#00ff88",
                                border: "1px solid rgba(0,255,136,0.2)",
                              }
                            : {
                                background: "rgba(255,255,255,0.03)",
                                color: "#3d4f66",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }
                        }
                      >
                        {p.online ? "ONLINE" : "OFFLINE"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-xs font-mono uppercase tracking-widest flex items-center gap-2"
                  style={{ color: "#00d4ff" }}
                >
                  <span className="w-0.5 h-4 rounded-full bg-[#00d4ff]" />
                  ALL TICKETS ({supportTickets.length})
                </h2>
                <button
                  type="button"
                  onClick={() => void loadSupport()}
                  disabled={supportLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#7a8aa0",
                  }}
                >
                  <RefreshCw size={12} className={supportLoading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  {
                    label: "Open",
                    count: supportTickets.filter((t) => t.status === "open").length,
                    color: "#00d4ff",
                    bg: "rgba(0,212,255,0.08)",
                  },
                  {
                    label: "In Progress",
                    count: supportTickets.filter((t) => t.status === "in-progress").length,
                    color: "#ffaa00",
                    bg: "rgba(255,170,0,0.08)",
                  },
                  {
                    label: "Resolved",
                    count: supportTickets.filter((t) => t.status === "resolved").length,
                    color: "#00ff88",
                    bg: "rgba(0,255,136,0.08)",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl p-3 text-center"
                    style={{
                      background: stat.bg,
                      border: `1px solid ${stat.color}30`,
                    }}
                  >
                    <p className="text-2xl font-bold" style={{ color: stat.color }}>
                      {stat.count}
                    </p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: `${stat.color}aa` }}>
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {supportLoading ? (
                  <p className="text-center py-4 text-xs font-mono" style={{ color: "#7a8aa0" }}>
                    Loading...
                  </p>
                ) : (
                  supportTickets.map((ticket) => {
                    const isExpanded = supportActiveTicket?.ticketId === ticket.ticketId;
                    return (
                      <div key={ticket.ticketId}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isExpanded) {
                              setSupportActiveTicket(null);
                              setSupportMessages([]);
                            } else {
                              setSupportActiveTicket(ticket);
                              void loadSupportMessages(ticket.ticketId);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                          style={
                            isExpanded
                              ? {
                                  background: "rgba(0,212,255,0.06)",
                                  border: "1px solid rgba(0,212,255,0.2)",
                                }
                              : {
                                  background: "rgba(255,255,255,0.02)",
                                  border: "1px solid rgba(255,255,255,0.06)",
                                }
                          }
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "#e8edf5" }}>
                              {ticket.subject}
                            </p>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
                              {ticket.patientEmail} · {ticket.assignedEmail ? `→ ${ticket.assignedEmail}` : "Unassigned"} ·{" "}
                              {ticket.category}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {ticket.dataConsent ? (
                              <Shield size={11} style={{ color: "#00ff88" }} />
                            ) : (
                              <ShieldOff size={11} style={{ color: "#3d4f66" }} />
                            )}
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                              style={{
                                background:
                                  ticket.status === "open"
                                    ? "rgba(0,212,255,0.08)"
                                    : ticket.status === "in-progress"
                                      ? "rgba(255,170,0,0.08)"
                                      : "rgba(0,255,136,0.08)",
                                color:
                                  ticket.status === "open"
                                    ? "#00d4ff"
                                    : ticket.status === "in-progress"
                                      ? "#ffaa00"
                                      : "#00ff88",
                              }}
                            >
                              {ticket.status}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div
                            className="mt-1 ml-4 rounded-xl overflow-hidden"
                            style={{
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            {supportMsgLoading ? (
                              <p className="text-center py-4 text-xs font-mono" style={{ color: "#7a8aa0" }}>
                                Loading messages...
                              </p>
                            ) : (
                              <div
                                className="max-h-64 overflow-y-auto p-3 space-y-2"
                                style={{
                                  background: "rgba(255,255,255,0.01)",
                                }}
                              >
                                {supportMessages.length === 0 ? (
                                  <p className="text-center py-4 text-xs font-mono" style={{ color: "#3d4f66" }}>
                                    No messages yet
                                  </p>
                                ) : (
                                  supportMessages.map((msg) => (
                                    <div
                                      key={msg.messageId}
                                      className={`flex ${msg.senderRole === "patient" ? "justify-start" : "justify-end"}`}
                                    >
                                      <div className="max-w-[80%]">
                                        <p className="text-[9px] font-mono mb-1" style={{ color: "#3d4f66" }}>
                                          {msg.senderRole === "patient" ? "Patient" : msg.senderEmail} ·{" "}
                                          {new Date(msg.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </p>
                                        <div
                                          className="px-3 py-2 rounded-xl text-xs"
                                          style={
                                            msg.senderRole === "patient"
                                              ? {
                                                  background: "rgba(255,255,255,0.04)",
                                                  color: "#e8edf5",
                                                  borderRadius: "4px 12px 12px 12px",
                                                }
                                              : {
                                                  background: "rgba(0,212,255,0.08)",
                                                  color: "#e8edf5",
                                                  borderRadius: "12px 4px 12px 12px",
                                                }
                                          }
                                        >
                                          {msg.text}
                                          {msg.attachments?.length > 0 && (
                                            <p className="text-[10px] mt-1" style={{ color: "#00d4ff" }}>
                                              📎 {msg.attachments.length} attachment(s)
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
