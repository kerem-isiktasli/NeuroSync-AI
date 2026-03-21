"use client";

import React, { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useReports } from "@/context/ReportsContext";
import type { ReportDoc } from "@/services/reportService";
import {
  Search,
  Filter,
  FileText,
  Calendar,
  Activity,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Shield,
  Info,
  Clock,
  Stethoscope,
} from "lucide-react";
import { getReportModeLabel, getReportModeBadgeClass } from "@/lib/reportTypes";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_CONFIG: Record<string, { label: string; labelTr: string; color: string }> = {
  uploaded:   { label: "Uploaded",   labelTr: "Yüklendi",    color: "bg-blue-500/10 text-blue-400" },
  processing: { label: "Processing", labelTr: "İşleniyor",  color: "bg-amber-500/10 text-amber-400" },
  complete:   { label: "Complete",   labelTr: "Tamamlandı",  color: "bg-emerald-500/10 text-emerald-400" },
  failed:     { label: "Failed",     labelTr: "Başarısız",   color: "bg-red-500/10 text-red-400" },
};

const CONCERN_CONFIG: Record<string, { label: string; labelTr: string; color: string; icon: typeof Shield }> = {
  low:             { label: "Low",           labelTr: "Düşük",  color: "text-emerald-400", icon: Shield },
  moderate:        { label: "Moderate",      labelTr: "Orta",   color: "text-amber-400",   icon: Info },
  high:            { label: "High",          labelTr: "Yüksek", color: "text-orange-400",  icon: AlertTriangle },
  "urgent-review": { label: "Urgent",        labelTr: "Acil",   color: "text-red-400",     icon: AlertTriangle },
};

function formatDate(iso: string, lang: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 2) return lang === "tr" ? "Az önce" : "Just now";
    if (mins < 60) return `${mins} ${lang === "tr" ? "dk önce" : "min ago"}`;
    if (hours < 24) return `${hours} ${lang === "tr" ? "saat önce" : "hr ago"}`;
    if (days < 7) return `${days} ${lang === "tr" ? "gün önce" : "days ago"}`;
    return d.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function MyReportsView({ onOpenReport }: { onOpenReport?: (reportId: string) => void }) {
  const { t, language } = useSettings();
  const { reports, loading, reportsError, removeReport } = useReports();
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = searchQuery.trim()
    ? reports.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.modality.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.anatomicalRegion.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : reports;

  const handleDelete = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    setDeletingId(reportId);
    await removeReport(reportId);
    setDeletingId(null);
  };

  const isPermissionError = reportsError?.message?.toLowerCase().includes("permission") ?? false;
  const isIndexError = reportsError?.message?.toLowerCase().includes("index") ?? false;

  return (
    <div className="h-full flex flex-col p-6 space-y-5" style={{ color: "#e8edf5" }}>
      {reportsError && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm"
          style={{
            background: "rgba(255,170,0,0.06)",
            border: "1px solid rgba(255,170,0,0.2)",
            color: "#ffaa00",
          }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {isPermissionError
                ? language === "tr"
                  ? "Raporlar yüklenemedi — yetki hatası."
                  : "Reports could not be loaded — permission error."
                : isIndexError
                  ? language === "tr"
                    ? "Raporlar yüklenemedi — indeks gerekli."
                    : "Reports could not be loaded — index required."
                  : language === "tr"
                    ? "Raporlar yüklenemedi."
                    : "Reports could not be loaded."}
            </p>
            <p className="text-xs mt-0.5 opacity-90">
              {isPermissionError
                ? "firebase deploy --only firestore:rules"
                : isIndexError
                  ? "firebase deploy --only firestore:indexes"
                  : reportsError.message}
            </p>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "#e8edf5" }}>
            {t("my_reports")}
          </h2>
          <p className="text-sm font-mono mt-0.5" style={{ color: "#7a8aa0" }}>
            {language === "tr"
              ? `${reports.length} rapor${reports.length !== 1 ? "" : ""}`
              : `${reports.length} report${reports.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </header>

      {/* Search & Filter */}
      {reports.length > 0 && (
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: "#3d4f66" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_reports")}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm transition-all outline-none focus:border-[rgba(0,212,255,0.4)]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e8edf5",
              }}
            />
          </div>
          <button
            type="button"
            className="px-3.5 py-2 rounded-xl flex items-center gap-2 text-sm transition-all"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "#7a8aa0",
            }}
          >
            <Filter size={15} />
            <span>{t("filter")}</span>
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 border-4 border-white/10 rounded-full animate-spin"
              style={{ borderTopColor: "#00d4ff", boxShadow: "0 0 16px rgba(0,212,255,0.25)" }}
            />
            <p className="text-sm font-mono" style={{ color: "#7a8aa0" }}>
              {language === "tr" ? "Raporlar yükleniyor..." : "Loading reports..."}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && reports.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.2)",
              boxShadow: "0 0 20px rgba(0,212,255,0.1)",
            }}
          >
            <FileText size={24} style={{ color: "#00d4ff" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#e8edf5" }}>
            {t("no_reports_yet")}
          </h3>
          <p className="text-sm max-w-sm mb-1" style={{ color: "#7a8aa0" }}>
            {t("no_reports_desc")}
          </p>
          <p className="text-xs" style={{ color: "#3d4f66" }}>
            {language === "tr"
              ? "Dashboard'dan bir tarama yükleyerek ilk raporunuzu oluşturun."
              : "Upload a scan from the Dashboard to create your first report."}
          </p>
        </div>
      )}

      {/* Report Cards */}
      {!loading && filtered.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          <AnimatePresence initial={false}>
            {filtered.map((report) => (
              <ReportCard
                key={report.reportId}
                report={report}
                language={language}
                onOpen={() => onOpenReport?.(report.reportId)}
                onDelete={(e) => handleDelete(e, report.reportId)}
                isDeleting={deletingId === report.reportId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Search no results */}
      {!loading && reports.length > 0 && filtered.length === 0 && searchQuery && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Search className="w-10 h-10 mb-3 opacity-40" style={{ color: "#3d4f66" }} />
          <p className="text-sm" style={{ color: "#7a8aa0" }}>
            {language === "tr" ? "Aramanızla eşleşen rapor bulunamadı." : "No reports matching your search."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Report Card ───

function ReportCard({
  report,
  language,
  onOpen,
  onDelete,
  isDeleting,
}: {
  report: ReportDoc;
  language: string;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}) {
  const status = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.uploaded;
  const concern = report.concernLevel ? CONCERN_CONFIG[report.concernLevel] : null;
  const ConcernIcon = concern?.icon ?? Shield;

  const statusBadgeStyle =
    report.status === "complete"
      ? {
          background: "rgba(0,255,136,0.08)",
          color: "#00ff88",
          border: "1px solid rgba(0,255,136,0.2)",
        }
      : report.status === "processing"
        ? {
            background: "rgba(255,170,0,0.08)",
            color: "#ffaa00",
            border: "1px solid rgba(255,170,0,0.2)",
          }
        : report.status === "failed"
          ? {
              background: "rgba(255,68,102,0.08)",
              color: "#ff4466",
              border: "1px solid rgba(255,68,102,0.2)",
            }
          : {
              background: "rgba(0,212,255,0.08)",
              color: "#00d4ff",
              border: "1px solid rgba(0,212,255,0.2)",
            };

  const concernTextStyle =
    report.concernLevel === "urgent-review"
      ? { color: "#ff4466" }
      : report.concernLevel === "high"
        ? { color: "#ffaa00" }
        : report.concernLevel === "moderate"
          ? { color: "#00d4ff" }
          : { color: "#00ff88" };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      onClick={onOpen}
      className="group relative flex items-start gap-3.5 p-4 rounded-xl cursor-pointer transition-all hover:border-[rgba(0,212,255,0.25)] hover:bg-[rgba(0,212,255,0.03)]"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: "rgba(0,212,255,0.08)",
          border: "1px solid rgba(0,212,255,0.2)",
        }}
      >
        {report.status === "processing" ? (
          <Activity className="w-4 h-4 animate-pulse" style={{ color: "#00d4ff" }} />
        ) : (
          <FileText className="w-4 h-4" style={{ color: "#00d4ff" }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <h4 className="text-sm font-semibold truncate" style={{ color: "#e8edf5" }}>
            {report.title || report.fileName}
          </h4>
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider"
            style={statusBadgeStyle}
          >
            {language === "tr" ? status.labelTr : status.label}
          </span>
          {report.reportMode && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${getReportModeBadgeClass(report.reportMode)}`}>
              {getReportModeLabel(report.reportMode, language as "tr" | "en")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-theme-text-muted mb-1.5">
          {report.modality && (
            <span className="flex items-center gap-1">
              <Stethoscope className="w-3 h-3" />
              {report.modality}
            </span>
          )}
          {report.anatomicalRegion && (
            <span>{report.anatomicalRegion}</span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(report.updatedAt, language)}
          </span>
        </div>

        {report.summary && (
          <p className="text-xs line-clamp-1" style={{ color: "#7a8aa0" }}>
            {report.summary}
          </p>
        )}

        {report.status === "failed" && report.errorMessage && (
          <p className="text-xs mt-1 line-clamp-1" style={{ color: "#ff4466" }}>
            {report.errorMessage}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0 self-center">
        {concern && report.status === "complete" && (
          <span className="flex items-center gap-1 text-[10px] font-semibold" style={concernTextStyle}>
            <ConcernIcon className="w-3 h-3" />
            {language === "tr" ? concern.labelTr : concern.label}
          </span>
        )}
        {report.keyFindings?.length > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: "#3d4f66", background: "rgba(255,255,255,0.04)" }}
          >
            {report.keyFindings.length} {language === "tr" ? "bulgu" : "findings"}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="p-1.5 rounded-lg transition-colors text-[#7a8aa0] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.08)]"
            title={language === "tr" ? "Aç" : "Open"}
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg transition-colors text-[#7a8aa0] hover:text-[#ff4466] hover:bg-[rgba(255,68,102,0.08)] disabled:opacity-50"
            title={language === "tr" ? "Sil" : "Delete"}
          >
            {isDeleting ? (
              <div
                className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                style={{ borderColor: "rgba(255,68,102,0.3)", borderTopColor: "#ff4466" }}
              />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
