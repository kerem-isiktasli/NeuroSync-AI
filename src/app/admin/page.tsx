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
  const [error, setError] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Partial<Config>>({});

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"config" | "users" | "reports">("config");
  const [usersLoading, setUsersLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-theme-accent/30 border-t-theme-accent rounded-full animate-spin" />
          <p className="text-theme-text-muted">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-lg hover:bg-theme-surface text-theme-text-muted hover:text-theme-text-primary transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <Shield className="w-8 h-8 text-theme-accent" />
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-theme-text-muted">Runtime configuration & oversight</p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-theme-surface rounded-xl border border-theme-border">
          {[
            { id: "config" as const, label: "Configuration", icon: Settings },
            { id: "users" as const, label: "Users", icon: Users },
            { id: "reports" as const, label: "Reports", icon: FileText },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                if (id === "users" && users.length === 0) void loadUsers();
                if (id === "reports" && reports.length === 0) void loadReports();
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-theme-accent text-theme-accent-foreground"
                  : "text-theme-text-muted hover:text-theme-text-primary"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {activeTab === "config" && (
          <div className="space-y-6">
            <section className="luxo-card p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Settings size={18} />
                AI Providers
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-theme-text-muted mb-1">Vertex model</label>
                  <input
                    type="text"
                    value={updates.vertexModel ?? config?.vertexModel ?? ""}
                    onChange={(e) => setUpdates((u) => ({ ...u, vertexModel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary"
                    placeholder="gemini-2.5-flash"
                  />
                </div>
                <div>
                  <label className="block text-theme-text-muted mb-1">Vertex fallback model</label>
                  <input
                    type="text"
                    value={updates.vertexFallbackModel ?? config?.vertexFallbackModel ?? ""}
                    onChange={(e) => setUpdates((u) => ({ ...u, vertexFallbackModel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary"
                    placeholder="gemini-2.5-flash"
                  />
                </div>
                <div>
                  <label className="block text-theme-text-muted mb-1">Anthropic model</label>
                  <input
                    type="text"
                    value={updates.anthropicModel ?? config?.anthropicModel ?? ""}
                    onChange={(e) => setUpdates((u) => ({ ...u, anthropicModel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary"
                    placeholder="claude-sonnet-4-6"
                  />
                </div>
              </div>
            </section>

            <section className="luxo-card p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <ToggleLeft size={18} />
                Feature flags
              </h2>
              <div className="space-y-3">
                {[
                  { key: "ocrEnabled" as const, label: "OCR (report screenshot extraction)" },
                  { key: "literatureEnabled" as const, label: "Literature search" },
                  { key: "fusionEnabled" as const, label: "Report fusion (image vs official report)" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-sm">{label}</span>
                    <input
                      type="checkbox"
                      checked={updates[key] ?? config?.[key] ?? true}
                      onChange={(e) => setUpdates((u) => ({ ...u, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-theme-border text-theme-accent"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="luxo-card p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Activity size={18} />
                Limits & thresholds
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-theme-text-muted mb-1">Max images per request</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={updates.maxImages ?? config?.maxImages ?? 50}
                    onChange={(e) => setUpdates((u) => ({ ...u, maxImages: parseInt(e.target.value, 10) || 50 }))}
                    className="w-full px-3 py-2 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-theme-text-muted mb-1">Classification confidence threshold (0–100)</label>
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
                    className="w-full px-3 py-2 rounded-lg bg-theme-surface border border-theme-border text-theme-text-primary"
                  />
                </div>
              </div>
            </section>

            {config?.updatedAt && (
              <p className="text-xs text-theme-text-muted">Last updated: {String(config.updatedAt)}</p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-theme-accent hover:bg-theme-accent/90 text-theme-accent-foreground font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Activity className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save configuration
                </>
              )}
            </button>

            <p className="text-xs text-theme-text-muted max-w-lg">
              Configuration is stored in Firestore and applied at runtime. Invalid values are rejected. Secrets (API keys) cannot be
              changed from this panel.
            </p>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">All Users ({users.length})</h2>
              <button
                type="button"
                onClick={() => void loadUsers()}
                disabled={usersLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-sm text-theme-text-muted hover:text-theme-text-primary disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={13} className={usersLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {usersLoading ? (
              <div className="text-center py-8 text-theme-text-muted text-sm">Loading users...</div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.uid} className="luxo-card p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-theme-text-primary truncate">{u.email}</p>
                      <p className="text-xs text-theme-text-muted mt-0.5">
                        {u.reportCount} reports · Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                        {u.disabled && <span className="ml-2 text-red-400">· DISABLED</span>}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void toggleUserDisabled(u.uid, u.disabled)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                          u.disabled
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        }`}
                      >
                        <Ban size={11} />
                        {u.disabled ? "Enable" : "Disable"}
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && !usersLoading && (
                  <p className="text-center py-8 text-theme-text-muted text-sm">No users found</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">All Reports ({reports.length})</h2>
              <button
                type="button"
                onClick={() => void loadReports()}
                disabled={reportsLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-sm text-theme-text-muted hover:text-theme-text-primary disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={13} className={reportsLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            {reportsLoading ? (
              <div className="text-center py-8 text-theme-text-muted text-sm">Loading reports...</div>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => (
                  <div key={report.reportId} className="luxo-card p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-theme-text-primary truncate">{report.title || "Untitled"}</p>
                      <p className="text-xs text-theme-text-muted mt-0.5">
                        {report.modality || "Unknown modality"} · {report.status} ·{" "}
                        {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "—"}
                      </p>
                      {report.userEmail && <p className="text-xs text-theme-text-muted">{report.userEmail}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          report.concernLevel === "urgent-review"
                            ? "bg-red-500/15 text-red-400"
                            : report.concernLevel === "high"
                              ? "bg-orange-500/15 text-orange-400"
                              : report.concernLevel === "moderate"
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-emerald-500/15 text-emerald-400"
                        }`}
                      >
                        {report.concernLevel || "low"}
                      </span>
                      <button
                        type="button"
                        onClick={() => void deleteReport(report.reportId)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && !reportsLoading && (
                  <p className="text-center py-8 text-theme-text-muted text-sm">No reports found</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
