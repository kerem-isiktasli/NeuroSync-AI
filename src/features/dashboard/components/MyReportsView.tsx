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
    <div className="h-full flex flex-col p-6 space-y-5">
      {reportsError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-200">
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
            <p className="text-xs text-amber-200/80 mt-0.5">
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
          <h2 className="text-2xl font-bold text-theme-text-primary">{t("my_reports")}</h2>
          <p className="text-sm text-theme-text-secondary">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_reports")}
              className="w-full pl-9 pr-4 py-2 bg-theme-surface-elevated border border-theme-border rounded-xl text-sm text-theme-text-primary placeholder:text-theme-text-muted focus:outline-none focus:border-theme-focus-ring transition-colors"
            />
          </div>
          <button className="px-3.5 py-2 bg-theme-surface-elevated border border-theme-border rounded-xl text-theme-text-secondary hover:text-theme-text-primary transition-colors flex items-center gap-2 text-sm">
            <Filter size={15} />
            <span>{t("filter")}</span>
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-theme-accent/30 border-t-theme-accent rounded-full animate-spin" />
            <p className="text-sm text-theme-text-muted">{language === "tr" ? "Raporlar yükleniyor..." : "Loading reports..."}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && reports.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center mb-4">
            <FileText className="text-theme-accent" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-theme-text-primary mb-2">{t("no_reports_yet")}</h3>
          <p className="text-sm text-theme-text-secondary max-w-sm mb-1">{t("no_reports_desc")}</p>
          <p className="text-xs text-theme-text-muted">
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
          <Search className="w-10 h-10 text-theme-text-muted mb-3 opacity-40" />
          <p className="text-sm text-theme-text-muted">
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      onClick={onOpen}
      className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-theme-border bg-theme-surface hover:bg-theme-surface-elevated cursor-pointer transition-all hover:border-theme-accent/20"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center shrink-0 mt-0.5">
        {report.status === "processing" ? (
          <Activity className="w-4.5 h-4.5 text-theme-accent animate-pulse" />
        ) : (
          <FileText className="w-4.5 h-4.5 text-theme-accent" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <h4 className="text-sm font-semibold text-theme-text-primary truncate">{report.title || report.fileName}</h4>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${status.color}`}>
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
          <p className="text-xs text-theme-text-secondary line-clamp-1">{report.summary}</p>
        )}

        {report.status === "failed" && report.errorMessage && (
          <p className="text-xs text-red-400 mt-1 line-clamp-1">{report.errorMessage}</p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0 self-center">
        {concern && report.status === "complete" && (
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${concern.color}`}>
            <ConcernIcon className="w-3 h-3" />
            {language === "tr" ? concern.labelTr : concern.label}
          </span>
        )}
        {report.keyFindings?.length > 0 && (
          <span className="text-[10px] text-theme-text-muted bg-theme-surface-elevated px-1.5 py-0.5 rounded">
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
            className="p-1.5 rounded-lg hover:bg-theme-accent/10 text-theme-text-muted hover:text-theme-accent transition-colors"
            title={language === "tr" ? "Aç" : "Open"}
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-theme-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
            title={language === "tr" ? "Sil" : "Delete"}
          >
            {isDeleting ? (
              <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
