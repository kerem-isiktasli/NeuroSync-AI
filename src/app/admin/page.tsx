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
} from "lucide-react";
import Link from "next/link";

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
              <p className="text-sm text-theme-text-muted">Runtime configuration</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

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
                  placeholder="claude-sonnet-4-20250514"
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
                  max={20}
                  value={updates.maxImages ?? config?.maxImages ?? 8}
                  onChange={(e) => setUpdates((u) => ({ ...u, maxImages: parseInt(e.target.value, 10) || 8 }))}
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
            <p className="text-xs text-theme-text-muted">Last updated: {config.updatedAt}</p>
          )}

          <button
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
        </div>

        <p className="mt-6 text-xs text-theme-text-muted max-w-lg">
          Configuration is stored in Firestore and applied at runtime. Invalid values are rejected.
          Secrets (API keys) cannot be changed from this panel.
        </p>
      </div>
    </div>
  );
}
