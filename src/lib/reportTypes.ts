/**
 * Report type labels and helpers — truthful representation of analysis depth.
 * Ensures metadata-only and limited reports are clearly distinguishable.
 */
import type { ReportMode } from "@/types/diagnosis";

export const REPORT_MODE_LABELS: Record<
  ReportMode,
  { en: string; tr: string; badgeColor: string; isLimited: boolean }
> = {
  FULL_INTERPRETATION_REPORT: {
    en: "Full Image Interpretation",
    tr: "Tam Görüntü Yorumlaması",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    isLimited: false,
  },
  LIMITED_IMAGE_ANALYSIS_REPORT: {
    en: "Limited Image Analysis",
    tr: "Sınırlı Görüntü Analizi",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    isLimited: true,
  },
  METADATA_ONLY_REPORT: {
    en: "Metadata Only — No Pixel Analysis",
    tr: "Yalnızca Metadatası — Piksel Analizi Yok",
    badgeColor: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    isLimited: true,
  },
  LOCALIZER_DETECTED_REPORT: {
    en: "Localizer / Positioning Scan — NOT Diagnostic",
    tr: "Lokalizör / Pozisyon Taraması — Tanısal Değil",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    isLimited: true,
  },
  DOCUMENT_EXTRACTION_REPORT: {
    en: "Document Extraction — Report Text Only",
    tr: "Belge Çıkarımı — Yalnızca Rapor Metni",
    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    isLimited: true,
  },
  FUSION_REPORT: {
    en: "Image + Report Fusion",
    tr: "Görüntü + Rapor Birleştirmesi",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    isLimited: false,
  },
  LIMITED_INTERPRETATION_REPORT: {
    en: "Limited Interpretation",
    tr: "Sınırlı Yorumlama",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    isLimited: true,
  },
  LIMITED_METADATA_REPORT: {
    en: "Limited Metadata",
    tr: "Sınırlı Metadatası",
    badgeColor: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    isLimited: true,
  },
  LIMITED_SCREENSHOT_REPORT: {
    en: "Limited Screenshot Analysis",
    tr: "Sınırlı Ekran Görüntüsü Analizi",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    isLimited: true,
  },
};

export function getReportModeLabel(mode: ReportMode | string | undefined, lang: "tr" | "en"): string {
  if (!mode) return lang === "tr" ? "Rapor" : "Report";
  const cfg = REPORT_MODE_LABELS[mode as ReportMode];
  return cfg ? (lang === "tr" ? cfg.tr : cfg.en) : String(mode);
}

export function getReportModeBadgeClass(mode: ReportMode | string | undefined): string {
  if (!mode) return "bg-theme-surface text-theme-text-secondary border-theme-border";
  const cfg = REPORT_MODE_LABELS[mode as ReportMode];
  return cfg ? `border ${cfg.badgeColor}` : "bg-theme-surface text-theme-text-secondary border-theme-border";
}

export function isLimitedReportMode(mode: ReportMode | string | undefined): boolean {
  if (!mode) return false;
  const cfg = REPORT_MODE_LABELS[mode as ReportMode];
  return cfg?.isLimited ?? true;
}
