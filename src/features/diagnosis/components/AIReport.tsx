"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Download,
  FileText,
  Eye,
  AlertTriangle,
  Info,
  BookOpen,
  Stethoscope,
  ClipboardList,
  Shield,
  ChevronDown,
  ChevronUp,
  Gauge,
  FileQuestion,
  Flag,
  Library,
  ListOrdered,
  CheckCheck,
} from "lucide-react";
import { useDiagnosis } from "../context/DiagnosisContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import type {
  DiagnosisResult,
  ReportSections,
  DifferentialConsideration,
  AdditionalDataRequest,
  LiteratureReference,
} from "@/types/diagnosis";
import {
  getReportModeLabel,
  getReportModeBadgeClass,
  isLimitedReportMode,
} from "@/lib/reportTypes";

// ─── FONT LOADING ───────────────────────────────────────

let fontBase64Cache: string | null = null;
let fontLoadPromise: Promise<string> | null = null;

function loadNotoSansFont(): Promise<string> {
  if (fontBase64Cache) return Promise.resolve(fontBase64Cache);
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = fetch("/fonts/NotoSans-Regular.ttf")
    .then((res) => {
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      return res.arrayBuffer();
    })
    .then((buf) => {
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fontBase64Cache = btoa(binary);
      return fontBase64Cache;
    })
    .catch((err) => {
      console.warn("[AIReport] Font load failed, PDF will use fallback:", err);
      fontLoadPromise = null;
      return "";
    });

  return fontLoadPromise;
}

// ─── HELPERS ────────────────────────────────────────────

function hasSections(r?: ReportSections): boolean {
  if (!r) return false;
  return !!(
    r.exam_overview ||
    r.technical_summary ||
    (r.detailed_findings && r.detailed_findings.length) ||
    r.interpretive_impression ||
    (r.limitations && r.limitations.length) ||
    (r.next_steps && r.next_steps.length)
  );
}

const CONCERN_CONFIG: Record<string, { label: string; labelTr: string; color: string; icon: typeof AlertTriangle }> = {
  low:            { label: "Low",           labelTr: "Düşük",    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Shield },
  moderate:       { label: "Moderate",      labelTr: "Orta",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20",       icon: Info },
  high:           { label: "High",          labelTr: "Yüksek",   color: "bg-orange-500/10 text-orange-400 border-orange-500/20",    icon: AlertTriangle },
  "urgent-review":{ label: "Urgent Review", labelTr: "Acil",     color: "bg-red-500/10 text-red-400 border-red-500/20",             icon: AlertTriangle },
  medium:         { label: "Medium",        labelTr: "Orta",     color: "bg-amber-500/10 text-amber-400 border-amber-500/20",       icon: Info },
  critical:       { label: "Critical",      labelTr: "Kritik",   color: "bg-red-500/10 text-red-400 border-red-500/20",             icon: AlertTriangle },
};

const LIKELIHOOD_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/30",
  moderate: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-slate-500/15 text-slate-400",
};

function getConcern(level?: string) {
  return CONCERN_CONFIG[level ?? "moderate"] ?? CONCERN_CONFIG.moderate;
}

function removeJSONArtifacts(text: string) {
  if (!text) return "";
  return text
    .replace(/[{}"']/g, "")
    .replace(/```json/gi, "").replace(/```/gi, "")
    .replace(/diagnosis:/gi, "").replace(/findings:/gi, "")
    .replace(/clinical_eval:/gi, "").replace(/affected_organ:/gi, "")
    .replace(/severity:/gi, "").replace(/reasoning:/gi, "")
    .replace(/SAPTANAN BULGULAR:?/gi, "").replace(/BÖLÜM \d:?/gi, "")
    .replace(/\\n/g, "\n").trim();
}

function getConfidenceLabel(confidence: number, lang: "tr" | "en"): string {
  if (confidence >= 80) return lang === "tr" ? "Yüksek" : "High";
  if (confidence >= 50) return lang === "tr" ? "Orta" : "Moderate";
  return lang === "tr" ? "Düşük" : "Low";
}

// ─── COLLAPSIBLE SECTION ────────────────────────────────

function Section({ icon: Icon, title, children, defaultOpen = true, accent }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl overflow-hidden ${accent ? "border-red-500/30" : "border-theme-border"}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 p-4 hover:bg-theme-surface-elevated transition-colors text-left ${accent ? "bg-red-500/5" : "bg-theme-surface"}`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${accent ? "text-red-400" : "text-theme-accent"}`} />
        <span className={`flex-1 font-semibold text-sm ${accent ? "text-red-300" : "text-theme-text-primary"}`}>{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-theme-text-muted" /> : <ChevronDown className="w-4 h-4 text-theme-text-muted" />}
      </button>
      {open && (
        <div className="p-4 pt-2 space-y-2 text-sm text-theme-text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </motion.div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 ml-1">
      {items.filter(Boolean).map((item, i) => (
        <li key={i} className="flex gap-2.5 items-start">
          <span className="text-theme-accent/60 mt-1.5 text-[8px]">●</span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── jsPDF HELPERS ──────────────────────────────────────

function setupFont(doc: jsPDF, fontB64: string) {
  if (!fontB64) return;
  doc.addFileToVFS("NotoSans-Regular.ttf", fontB64);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans", "normal");
}

function pdfText(
  doc: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize: number,
  opts?: { color?: [number, number, number]; lineHeight?: number }
): number {
  doc.setFontSize(fontSize);
  if (opts?.color) doc.setTextColor(...opts.color);
  else doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(text, maxWidth);
  const lh = opts?.lineHeight ?? fontSize * 0.45;
  doc.text(lines, x, y, { maxWidth });
  return y + lines.length * lh;
}

function pdfSectionTitle(doc: jsPDF, title: string, x: number, y: number, pageWidth: number, margin: number): number {
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(title, x, y);
  y += 1;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(x, y, pageWidth - margin, y);
  return y + 5;
}

function ensurePage(doc: jsPDF, y: number, needed: number, pageHeight: number, margin: number): number {
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin + 5;
  }
  return y;
}

function pdfBullets(doc: jsPDF, items: string[], x: number, y: number, cw: number, ph: number, m: number, fontSize = 9): number {
  for (const item of items) {
    y = ensurePage(doc, y, 8, ph, m);
    doc.setFontSize(fontSize);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(`\u2022 ${item}`, cw - 4);
    doc.text(lines, x + 2, y);
    y += lines.length * (fontSize * 0.44) + 1.5;
  }
  return y;
}

// ─── PDF REPORT BUILDER ─────────────────────────────────

function generatePdfDoc(data: DiagnosisResult, lang: "tr" | "en", fontB64: string): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFont(doc, fontB64);

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 18;
  const cw = pw - m * 2;
  let y = m;

  const now = new Date().toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // ── LOCALIZER_DETECTED: distinct PDF layout ──
  if (data.reportType === "LOCALIZER_DETECTED" && data.localizerReport) {
    const lr = data.localizerReport;
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text("RapiMed", pw / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(180, 120, 40);
    doc.text(lang === "tr" ? "Lokalizör / Pozisyonlama Taraması" : "Localizer / Positioning Scan", pw / 2, y, { align: "center" });
    y += 8;
    doc.setDrawColor(180, 120, 40);
    doc.setLineWidth(0.5);
    doc.line(m, y, pw - m, y);
    y += 8;

    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    if (data.fileName) { doc.text(`${lang === "tr" ? "Dosya" : "File"}: ${data.fileName}`, m, y); y += 4; }
    doc.text(`${lang === "tr" ? "Oluşturulma" : "Generated"}: ${now}`, m, y); y += 6;

    y = pdfSectionTitle(doc, lang === "tr" ? "TESPİT EDİLEN" : "WHAT WAS DETECTED", m, y, pw, m);
    y = pdfText(doc, lr.interpretation, m, y, cw, 10, { color: [30, 30, 30] });
    y += 6;

    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "NEDEN TANISAL DEĞİL" : "WHY THIS IS NOT DIAGNOSTIC", m, y, pw, m);
    y = pdfText(doc, lr.explanation, m, y, cw, 9);
    y += 6;

    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "GÜVEN / TESPİT GÖSTERGELERİ" : "CONFIDENCE / DETECTED INDICATORS", m, y, pw, m);
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`${lang === "tr" ? "Güven" : "Confidence"}: ${Math.round((lr.confidence ?? 0) * 100)}%`, m, y); y += 5;
    y = pdfBullets(doc, lr.detectedIndicators, m, y, cw, ph, m, 8.5);
    y += 6;

    y = ensurePage(doc, y, 20, ph, m);
    doc.setFillColor(230, 250, 230);
    doc.roundedRect(m, y, cw, 8, 1, 1, "F");
    doc.setFontSize(9);
    doc.setTextColor(40, 120, 60);
    doc.text(lang === "tr" ? "TAM OLARAK NE YÜKLENMELİ" : "EXACT NEXT UPLOADS NEEDED", m + 4, y + 5.5);
    y += 12;
    doc.setTextColor(30, 30, 30);
    y = pdfBullets(doc, lr.recommendation, m, y, cw, ph, m, 9);
    y += 8;

    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    const disc = data.medical_disclaimer || (lang === "tr" ? "Bu çıktı bilgilendirme amaçlıdır." : "This output is for informational purposes only.");
    const discLines = doc.splitTextToSize(disc, cw);
    doc.text(discLines, m, y);
    y += discLines.length * 3.5 + 6;

    for (let i = 1; i <= doc.getNumberOfPages(); i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`RapiMed — ${lang === "tr" ? "Lokalizör Tespit Raporu" : "Localizer Detection Report"} — ${now}`, pw / 2, ph - 10, { align: "center" });
    }
    return doc;
  }

  const concern = getConcern(data.concern_level ?? data.severity);
  const concernLabel = lang === "tr" ? concern.labelTr : concern.label;
  const s = data.report_sections;
  const hasRich = hasSections(s);

  // ── 1. HEADER ──
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text("RapiMed", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(lang === "tr" ? "Tıbbi Görüntü Yorumlama Raporu" : "AI Medical Image Interpretation Report", pw / 2, y, { align: "center" });
  y += 5;
  if (data.reportMode) {
    const reportTypeLabel = getReportModeLabel(data.reportMode, lang);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${lang === "tr" ? "Rapor Türü" : "Report Type"}: ${reportTypeLabel}`, pw / 2, y, { align: "center" });
    y += 4;
  }
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(m, y, pw - m, y);
  y += 6;

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const metaLines: string[] = [];
  if (data.modality) metaLines.push(`${lang === "tr" ? "Modalite" : "Modality"}: ${data.modality}`);
  if (data.anatomical_region) metaLines.push(`${lang === "tr" ? "Bölge" : "Region"}: ${data.anatomical_region}`);
  if (data.fileName) metaLines.push(`${lang === "tr" ? "Dosya" : "File"}: ${data.fileName}`);
  metaLines.push(`${lang === "tr" ? "Oluşturulma" : "Generated"}: ${now}`);
  metaLines.push(`${lang === "tr" ? "Endişe Düzeyi" : "Concern Level"}: ${concernLabel}`);
  for (const line of metaLines) { doc.text(line, m, y); y += 3.8; }
  y += 6;

  // ── 3. SUMMARY ──
  y = ensurePage(doc, y, 20, ph, m);
  y = pdfSectionTitle(doc, lang === "tr" ? "ÖZET" : "SUMMARY", m, y, pw, m);
  y = pdfText(doc, data.diagnosis || "", m, y, cw, 10, { color: [30, 30, 30] });
  y += 6;

  // ── 4. EXAM OVERVIEW ──
  if (hasRich && s?.exam_overview) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "İNCELEME ÖZETİ" : "EXAM OVERVIEW", m, y, pw, m);
    y = pdfText(doc, s.exam_overview, m, y, cw, 9);
    y += 6;
  }

  // ── 5. TECHNICAL SUMMARY ──
  if (hasRich && s?.technical_summary) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "TEKNİK ÖZET" : "TECHNICAL SUMMARY", m, y, pw, m);
    y = pdfText(doc, s.technical_summary, m, y, cw, 9);
    y += 6;
  }

  // ── 5a. STUDY ADEQUACY ──
  if (hasRich && s?.study_adequacy_summary) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "ÇALIŞMA YETERLİLİĞİ" : "STUDY ADEQUACY", m, y, pw, m);
    y = pdfText(doc, s.study_adequacy_summary, m, y, cw, 9);
    y += 6;
  }

  // ── 5b. ANATOMICAL SPECIFICITY ──
  if (hasRich && s?.anatomical_specificity_summary) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "ANATOMİK SPESİFİKLİK" : "ANATOMICAL SPECIFICITY", m, y, pw, m);
    y = pdfText(doc, s.anatomical_specificity_summary, m, y, cw, 9);
    y += 6;
  }

  // ── 5c. EVIDENCE AGREEMENT ──
  if (hasRich && s?.evidence_agreement_summary) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "GÖRÜNTÜ UYUMU" : "EVIDENCE AGREEMENT", m, y, pw, m);
    y = pdfText(doc, s.evidence_agreement_summary, m, y, cw, 9);
    y += 6;
  }

  // ── 5d. AI VS OFFICIAL REPORT (FUSION) ──
  const fusion = data.report_fusion;
  if (fusion?.official_report_present) {
    y = ensurePage(doc, y, 25, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "AI İLE RESMİ RAPOR KARŞILAŞTIRMASI" : "AI VS OFFICIAL REPORT", m, y, pw, m);
    if (fusion.agreement_points?.length) {
      doc.setFontSize(9);
      doc.setTextColor(40, 120, 80);
      doc.text(lang === "tr" ? "Uyumlu bulgular:" : "Agreements:", m, y);
      y += 4;
      y = pdfBullets(doc, fusion.agreement_points, m, y, cw, ph, m, 8.5);
      y += 2;
    }
    if (fusion.mismatch_points?.length) {
      doc.setFontSize(9);
      doc.setTextColor(180, 120, 40);
      doc.text(lang === "tr" ? "Farklılıklar:" : "Disagreements:", m, y);
      y += 4;
      for (const mm of fusion.mismatch_points) {
        y = ensurePage(doc, y, 12, ph, m);
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const line = `${lang === "tr" ? "AI:" : "AI:"} ${mm.image_finding} | ${lang === "tr" ? "Rapor:" : "Report:"} ${mm.report_finding}`;
        const lines = doc.splitTextToSize(`\u2022 ${line}`, cw - 4);
        doc.text(lines, m + 2, y);
        y += lines.length * 3.5 + 1;
        if (mm.note) {
          const noteLines = doc.splitTextToSize(`  ${mm.note}`, cw - 6);
          doc.text(noteLines, m + 4, y);
          y += noteLines.length * 3.5 + 2;
        }
      }
      y += 2;
    }
    if (fusion.official_report_priority_note) {
      y = ensurePage(doc, y, 15, ph, m);
      doc.setFillColor(255, 248, 220);
      doc.roundedRect(m, y, cw, 12, 1, 1, "F");
      doc.setFontSize(8);
      doc.setTextColor(140, 100, 40);
      const prioLines = doc.splitTextToSize(`${lang === "tr" ? "Önemli:" : "Important:"} ${fusion.official_report_priority_note}`, cw - 8);
      doc.text(prioLines, m + 4, y + 4);
      y += 14;
    }
    doc.setTextColor(60, 60, 60);
    y += 6;
  }

  // ── 6. DETAILED FINDINGS ──
  const findings = hasRich && s?.detailed_findings?.length ? s.detailed_findings
    : data.key_findings?.length ? data.key_findings
    : data.findings ? removeJSONArtifacts(data.findings).split("\n").filter(Boolean) : [];
  if (findings.length > 0) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "DETAYLI BULGULAR" : "DETAILED FINDINGS", m, y, pw, m);
    y = pdfBullets(doc, findings, m, y, cw, ph, m);
    y += 4;
  }

  // ── 6a. FINDINGS BY LEVEL ──
  if (hasRich && s?.findings_by_level_summary) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "SEVİYE BAZLI BULGULAR" : "FINDINGS BY LEVEL", m, y, pw, m);
    y = pdfText(doc, s.findings_by_level_summary, m, y, cw, 9);
    y += 6;
  }

  // ── 7. INTERPRETIVE IMPRESSION ──
  if (hasRich && s?.interpretive_impression) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "YORUMLAYICI İZLENİM" : "INTERPRETIVE IMPRESSION", m, y, pw, m);
    y = pdfText(doc, s.interpretive_impression, m, y, cw, 9);
    y += 6;
  }

  // ── 7a. WHAT CANNOT BE DETERMINED ──
  if (hasRich && s?.what_cannot_be_determined?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "BELİRLENEMEYENLER" : "WHAT CANNOT BE DETERMINED", m, y, pw, m);
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    y = pdfBullets(doc, s.what_cannot_be_determined, m, y, cw, ph, m, 8.5);
    doc.setTextColor(60, 60, 60);
    y += 4;
  }

  // ── 8. DIFFERENTIAL CONSIDERATIONS ──
  if (data.differential_considerations?.length) {
    y = ensurePage(doc, y, 20, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "OLASI AÇIKLAMALAR" : "DIFFERENTIAL CONSIDERATIONS", m, y, pw, m);
    for (const dc of data.differential_considerations) {
      y = ensurePage(doc, y, 16, ph, m);
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(`${dc.label} [${dc.likelihood}]`, m + 2, y);
      y += 4;
      doc.setFontSize(8);
      doc.setTextColor(70, 70, 70);
      const matchLines = doc.splitTextToSize(`${lang === "tr" ? "Neden uyumlu" : "Why it matches"}: ${dc.why_it_matches}`, cw - 6);
      doc.text(matchLines, m + 4, y);
      y += matchLines.length * 3.5 + 1;
      const certLines = doc.splitTextToSize(`${lang === "tr" ? "Neden kesin değil" : "Why not certain"}: ${dc.why_not_certain}`, cw - 6);
      doc.text(certLines, m + 4, y);
      y += certLines.length * 3.5 + 3;
    }
    y += 2;
  }

  // ── 9. RED FLAGS ──
  if (data.red_flags?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "KIRMIZI BAYRAKLAR" : "RED FLAGS", m, y, pw, m);
    doc.setTextColor(180, 40, 40);
    y = pdfBullets(doc, data.red_flags, m, y, cw, ph, m, 9);
    doc.setTextColor(60, 60, 60);
    y += 4;
  }

  // ── 10. ADDITIONAL DATA REQUESTED ──
  if (data.additional_data_requested?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "EK VERİ İHTİYACI" : "ADDITIONAL DATA REQUESTED", m, y, pw, m);
    for (const req of data.additional_data_requested) {
      y = ensurePage(doc, y, 10, ph, m);
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(`\u2022 ${req.item} [${req.priority}]: ${req.reason}`, cw - 4);
      doc.text(lines, m + 2, y);
      y += lines.length * 3.8 + 1.5;
    }
    y += 4;
  }

  // ── 11. IMPORTANT TERMS ──
  if (data.important_terms?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "ÖNEMLİ TERİMLER" : "IMPORTANT TERMS", m, y, pw, m);
    for (const term of data.important_terms) {
      y = ensurePage(doc, y, 8, ph, m);
      const str = `${term.term}: ${term.plain_explanation}`;
      const lines = doc.splitTextToSize(str, cw - 4);
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 50);
      doc.text(lines, m + 2, y);
      y += lines.length * 3.8 + 1.5;
    }
    y += 4;
  }

  // ── 12. QUESTIONS FOR DOCTOR ──
  if (data.questions_for_doctor?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "DOKTORA SORULACAK SORULAR" : "QUESTIONS FOR YOUR DOCTOR", m, y, pw, m);
    y = pdfBullets(doc, data.questions_for_doctor, m, y, cw, ph, m);
    y += 4;
  }

  // ── 13. FOLLOW-UP ──
  if (data.follow_up_considerations?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "TAKİP DEĞERLENDİRMELERİ" : "FOLLOW-UP CONSIDERATIONS", m, y, pw, m);
    y = pdfBullets(doc, data.follow_up_considerations, m, y, cw, ph, m);
    y += 4;
  }

  // ── 14. LIMITATIONS ──
  const limitations = hasRich && s?.limitations?.length ? s.limitations : [];
  if (limitations.length > 0) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "SINIRLAMALAR" : "LIMITATIONS", m, y, pw, m);
    y = pdfBullets(doc, limitations, m, y, cw, ph, m, 8.5);
    y += 4;
  }

  // ── 15. NEXT STEPS ──
  if (hasRich && s?.next_steps?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "SONRAKİ ADIMLAR" : "NEXT STEPS", m, y, pw, m);
    y = pdfBullets(doc, s.next_steps, m, y, cw, ph, m);
    y += 4;
  }

  // ── 16. CONFIDENCE ASSESSMENT ──
  const confReasons = data.confidence_reasons?.length ? data.confidence_reasons : [];
  const confLevel = data.confidence_level || (data.confidence > 0 ? getConfidenceLabel(data.confidence, lang) : "");
  if (confLevel || confReasons.length > 0) {
    y = ensurePage(doc, y, 20, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "GÜVENİLİRLİK DEĞERLENDİRMESİ" : "CONFIDENCE ASSESSMENT", m, y, pw, m);
    if (confLevel) {
      const label = lang === "tr" ? "Güvenilirlik Düzeyi" : "Confidence Level";
      y = pdfText(doc, `${label}: ${confLevel}${data.confidence > 0 ? ` (${data.confidence}%)` : ""}`, m, y, cw, 9);
      y += 2;
    }
    if (confReasons.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text(lang === "tr" ? "Nedenleri:" : "Reasons:", m, y);
      y += 4;
      y = pdfBullets(doc, confReasons, m, y, cw, ph, m, 8);
    }
    y += 4;
  }

  // ── 17. LITERATURE SUPPORT ──
  if (data.literature_support?.length) {
    y = ensurePage(doc, y, 15, ph, m);
    y = pdfSectionTitle(doc, lang === "tr" ? "LİTERATÜR DESTEĞİ" : "LITERATURE SUPPORT", m, y, pw, m);
    for (const lit of data.literature_support) {
      y = ensurePage(doc, y, 10, ph, m);
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      const text = `${lit.title} (${lit.source}, ${lit.year}) ${lit.relevance ? "— " + lit.relevance : ""}`;
      const lines = doc.splitTextToSize(text, cw - 4);
      doc.text(lines, m + 2, y);
      y += lines.length * 3.5 + 2;
    }
    y += 4;
  }

  // ── 18. MEDICAL DISCLAIMER ──
  y = ensurePage(doc, y, 18, ph, m);
  const disclaimer = data.medical_disclaimer || (lang === "tr"
    ? "Bu çıktı bilgilendirme amaçlıdır. Kesin tanı ve tedavi için uzman hekim değerlendirmesi gereklidir."
    : "This output is for informational purposes only and does not replace medical advice from a licensed clinician.");
  doc.setFillColor(255, 252, 232);
  doc.roundedRect(m, y, cw, 14, 1, 1, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 100, 60);
  const discLines = doc.splitTextToSize(`${lang === "tr" ? "Tıbbi Uyarı" : "Medical Disclaimer"}: ${disclaimer}`, cw - 8);
  doc.text(discLines, m + 4, y + 4);
  y += 18;

  // ── 19. FOOTER ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = ph - 10;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(m, footerY - 2, pw - m, footerY - 2);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `RapiMed \u2014 ${lang === "tr" ? "Yapay Zeka Destekli Tıbbi Yorumlama" : "AI-Assisted Medical Interpretation"} \u2014 ${now}`,
      pw / 2, footerY, { align: "center" }
    );
  }

  return doc;
}

// ─── MAIN COMPONENT ─────────────────────────────────────

export default function AIReport() {
  const { diagnosisResult, isAnalyzing } = useDiagnosis();
  const { t, language } = useSettings();
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [, setFontReady] = useState(false);

  useEffect(() => {
    loadNotoSansFont().then((b64) => { if (b64) setFontReady(true); });
  }, []);

  if (!diagnosisResult && isAnalyzing) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 flex items-center justify-center mb-5">
          <Activity className="w-7 h-7 text-theme-accent animate-pulse" />
        </div>
        <p className="text-body font-medium text-theme-text-primary">
          {language === "tr" ? "Raporunuz analiz ediliyor…" : "Analyzing your report…"}
        </p>
        <p className="text-caption mt-1">
          {language === "tr" ? "Bu genellikle birkaç saniye sürer." : "This usually takes a few seconds."}
        </p>
        <div className="w-full max-w-xs mt-6 h-1.5 bg-theme-surface rounded-full overflow-hidden">
          <motion.div className="h-full bg-theme-accent rounded-full" initial={{ width: "0%" }} animate={{ width: "70%" }} transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }} />
        </div>
      </div>
    );
  }

  if (!diagnosisResult) {
    return (
      <div className="empty-state flex-1 min-h-[280px]">
        <div className="empty-state-icon"><FileText className="w-8 h-8 text-theme-text-muted" /></div>
        <h3 className="text-h3 mb-2">{language === "tr" ? "Henüz rapor yok" : "No report yet"}</h3>
        <p className="text-body max-w-sm mb-1">
          {language === "tr"
            ? "Sol panelden bir tarama yükleyerek AI yorumunuzu burada görün."
            : "Upload a scan from the left panel to see your AI interpretation here."}
        </p>
        <p className="text-caption">
          {language === "tr"
            ? "Yapılandırılmış bulgular, sonraki adımlar ve dışa aktarma seçenekleri analiz sonrası görünecektir."
            : "Structured findings, next steps, and export options will appear after analysis."}
        </p>
      </div>
    );
  }

  const data = diagnosisResult;
  const richSections = data.report_sections;
  const hasRich = hasSections(richSections);

  const concern = getConcern(data.concern_level ?? data.severity);
  const ConcernIcon = concern.icon;
  const concernLabel = language === "tr" ? concern.labelTr : concern.label;

  const displayDiagnosis = removeJSONArtifacts(data.diagnosis) || (language === "tr" ? "Klinik Analiz Tamamlandı" : "Clinical Analysis Complete");

  const keyFindings = data.key_findings?.length
    ? data.key_findings
    : data.findings ? removeJSONArtifacts(data.findings).split("\n").filter(Boolean) : [];

  const detailedFindings = hasRich && richSections?.detailed_findings?.length
    ? richSections.detailed_findings : keyFindings;

  const limitations = hasRich ? (richSections?.limitations ?? []) : [];

  const generatePDF = async (action: "download" | "view") => {
    try {
      setIsGeneratingPdf(true);
      setPdfError(null);
      const fontB64 = await loadNotoSansFont();
      const doc = generatePdfDoc(data, language as "tr" | "en", fontB64);
      if (action === "view") {
        window.open(doc.output("bloburl") as unknown as string, "_blank");
      } else {
        doc.save(`RapiMed_Report_${Date.now()}.pdf`);
      }
      setIsGeneratingPdf(false);
      toast({ title: t("export_report"), description: action === "download" ? "PDF downloaded." : "PDF opened in new tab." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF could not be generated.";
      console.error("PDF Generation Error:", err);
      setPdfError(message);
      setIsGeneratingPdf(false);
      toast({ variant: "destructive", title: t("export_unavailable"), description: message });
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col px-2 py-3 md:px-4 md:py-4">

      {/* ── REPORT TYPE BANNER (truthful analysis depth) ── */}
      {(data.reportMode || data.reportLabel) && (
        <div
          className={`mb-4 p-4 rounded-xl border ${isLimitedReportMode(data.reportMode) ? "border-amber-500/30 bg-amber-500/5" : "border-theme-border bg-theme-surface"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getReportModeBadgeClass(data.reportMode)}`}>
              {getReportModeLabel(data.reportMode, language as "tr" | "en")}
            </span>
            {data.reportLabel?.analyzedFileCount != null && (
              <span className="text-xs text-theme-text-muted">
                {data.reportLabel.displayUnit === "slices"
                  ? `${data.reportLabel.analyzedFileCount} ${language === "tr" ? "dosya" : "files"} · ${data.reportLabel.analyzedSliceCount ?? data.reportLabel.analyzedFileCount} ${language === "tr" ? "kesit" : "slices"}`
                  : `${data.reportLabel.analyzedFileCount} ${language === "tr" ? "görüntü" : "images"}`}
              </span>
            )}
            {data.reportLabel?.adequacyTier && (
              <span className="text-xs text-theme-text-muted">
                · {language === "tr" ? "Yeterlilik" : "Adequacy"}: {data.reportLabel.adequacyTier}
              </span>
            )}
          </div>
          {data.reportLabel && (data.reportLabel.whatWasActuallyAnalyzed.length > 0 || data.reportLabel.whatCouldNotBeDetermined.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mt-2">
              {data.reportLabel.whatWasActuallyAnalyzed.length > 0 && (
                <div>
                  <p className="font-medium text-theme-text-secondary mb-0.5">{language === "tr" ? "Analiz edilen:" : "What was analyzed:"}</p>
                  <ul className="list-disc list-inside text-theme-text-muted space-y-0.5">
                    {data.reportLabel.whatWasActuallyAnalyzed.slice(0, 3).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.reportLabel.whatCouldNotBeDetermined.length > 0 && (
                <div>
                  <p className="font-medium text-theme-text-secondary mb-0.5">{language === "tr" ? "Belirlenemedi:" : "Could not be determined:"}</p>
                  <ul className="list-disc list-inside text-theme-text-muted space-y-0.5">
                    {data.reportLabel.whatCouldNotBeDetermined.slice(0, 3).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex justify-between items-start gap-4 mb-5 pb-4 border-b border-theme-border">
        <div className="min-w-0">
          <h3 className="text-h2 flex items-center gap-2 flex-wrap">
            {data.reportType === "LOCALIZER_DETECTED" ? (
              <FileQuestion className="text-amber-500 shrink-0" />
            ) : (
              <Activity className="text-theme-accent shrink-0" />
            )}
            <span className="text-theme-text-primary">
              {data.reportType === "LOCALIZER_DETECTED"
                ? (language === "tr" ? "Lokalizör / Pozisyonlama Taraması" : "Localizer / Positioning Scan")
                : "RapiMed Report"}
            </span>
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-caption">
            <span>{new Date(data.timestamp).toLocaleDateString()}</span>
            {data.modality && <span className="text-theme-text-secondary font-medium">{data.modality}</span>}
            {data.anatomical_region && <span className="text-theme-text-secondary font-medium">{data.anatomical_region}</span>}
            {data.fileName && <span className="truncate max-w-[180px] text-theme-text-secondary">{data.fileName}</span>}
          </div>
        </div>
        <div className={`shrink-0 px-3 py-1.5 rounded-full text-label border flex items-center gap-1.5 ${concern.color}`}>
          <ConcernIcon className="w-3.5 h-3.5" />
          {concernLabel}
        </div>
      </div>

      {/* ── BODY ── */}
      <div>
        <div className="max-w-3xl mx-auto pr-2 space-y-4 pb-6">

          {/* LOCALIZER_DETECTED: distinct report style — not a normal interpretation */}
          {data.reportType === "LOCALIZER_DETECTED" && data.localizerReport ? (
            <div className="space-y-5">
              <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-5">
                <h4 className="text-label uppercase tracking-wide text-amber-500/90 mb-3">
                  {language === "tr" ? "Tespit Edilen" : "What Was Detected"}
                </h4>
                <p className="text-theme-text-primary font-medium">{data.localizerReport.interpretation}</p>
              </div>
              <div className="rounded-xl border border-theme-border bg-theme-surface/50 p-5">
                <h4 className="text-label uppercase tracking-wide text-theme-text-muted mb-3">
                  {language === "tr" ? "Neden Tanısal Değil" : "Why This Is Not Diagnostic"}
                </h4>
                <p className="text-theme-text-secondary text-sm">{data.localizerReport.explanation}</p>
              </div>
              <div className="rounded-xl border border-theme-border bg-theme-surface/50 p-5">
                <h4 className="text-label uppercase tracking-wide text-theme-text-muted mb-3">
                  {language === "tr" ? "Güven / Tespit Göstergeleri" : "Confidence / Detected Indicators"}
                </h4>
                <p className="text-theme-text-secondary text-sm mb-2">
                  {language === "tr" ? "Güven:" : "Confidence:"} {Math.round((data.localizerReport.confidence ?? 0) * 100)}%
                </p>
                <ul className="list-disc list-inside text-sm text-theme-text-secondary space-y-0.5">
                  {data.localizerReport.detectedIndicators.map((ind, i) => (
                    <li key={i}>{ind}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <h4 className="text-label uppercase tracking-wide text-emerald-500/90 mb-3">
                  {language === "tr" ? "Tam Olarak Ne Yüklenmeli" : "Exact Next Uploads Needed"}
                </h4>
                <ul className="list-disc list-inside text-sm text-theme-text-primary space-y-1">
                  {data.localizerReport.recommendation.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
              <p className="text-caption text-theme-text-muted italic">
                {data.medical_disclaimer || (language === "tr" ? "Bu çıktı bilgilendirme amaçlıdır." : "This output is for informational purposes only.")}
              </p>
            </div>
          ) : data.reportType === "LOCALIZER_DETECTED" ? (
            /* Fallback when localizerReport missing */
            <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/10 p-5">
              <p className="font-semibold text-theme-text-primary mb-2">
                {language === "tr" ? "Yüklenen görüntüler MRI/CT lokalizör taramaları gibi görünüyor." : "Uploaded images appear to be MRI/CT localizer scans."}
              </p>
              <p className="text-theme-text-secondary text-sm mb-3">
                {language === "tr" ? "Lokalizörler pozisyon taramalarıdır; tanısal detay içermez." : "Localizers are positioning scans and do not contain diagnostic detail."}
              </p>
              <p className="text-sm text-theme-text-primary">
                {language === "tr" ? "Lütfen sagittal, aksiyel veya koronal kesitler ya da tam DICOM çalışması yükleyin." : "Please upload sagittal, axial, or coronal slices or the full DICOM study."}
              </p>
            </div>
          ) : null}

          {/* Summary (only for diagnostic reports) */}
          {data.reportType !== "LOCALIZER_DETECTED" && (
          <div className="mb-2">
            <label className="text-label mb-2 block text-theme-text-muted text-xs uppercase tracking-wide">
              {language === "tr" ? "Özet" : "Summary"}
            </label>
            <p className="text-lg font-bold text-theme-text-primary leading-snug">{displayDiagnosis}</p>
            {data.affected_organ && data.affected_organ !== "Görüntü Analizi" && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-theme-surface border border-theme-border text-theme-text-secondary">
                  {data.affected_organ}
                </span>
              </div>
            )}
          </div>
          )}

          {/* Upload Assessment (intake summary) - only for diagnostic */}
          {data.reportType !== "LOCALIZER_DETECTED" && data.intake_summary && (data.intake_summary.localizerCount ?? 0) + (data.intake_summary.reportImageCount ?? 0) + (data.intake_summary.hasMixedUpload ? 1 : 0) > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
              <Info className="w-5 h-5 shrink-0 text-amber-500/80 mt-0.5" />
              <div className="text-sm text-theme-text-secondary">
                <p className="font-medium text-theme-text-primary mb-1">
                  {language === "tr" ? "Yükleme Değerlendirmesi" : "Upload Assessment"}
                </p>
                <ul className="space-y-0.5 text-xs">
                  {data.intake_summary.reportImageCount && data.intake_summary.reportImageCount > 0 && (
                    <li>
                      {data.intake_summary.officialReportOcrUsed || data.report_fusion?.official_report_present
                        ? (language === "tr"
                          ? `Rapor ekran görüntüsü tespit edildi (${data.intake_summary.reportImageCount}); metin başarıyla çıkarıldı.`
                          : `Report screenshot(s) detected (${data.intake_summary.reportImageCount}); text was extracted.`)
                        : (language === "tr"
                          ? `Rapor ekran görüntüsü tespit edildi (${data.intake_summary.reportImageCount}); metin çıkarılamadı.`
                          : `Report screenshot(s) detected (${data.intake_summary.reportImageCount}); text could not be extracted.`)}
                    </li>
                  )}
                  {data.intake_summary.localizerCount && data.intake_summary.localizerCount > 0 && (
                    <li>
                      {language === "tr"
                        ? `Lokalizör görüntü tespit edildi (${data.intake_summary.localizerCount}); tanısal kesit değildir.`
                        : `Localizer image(s) detected (${data.intake_summary.localizerCount}); not diagnostic slices.`}
                    </li>
                  )}
                  {data.intake_summary.hasMixedUpload && (
                    <li>
                      {language === "tr"
                        ? "Karışık yükleme: tanısal görüntüler ve rapor/yerel görüntüler birlikte."
                        : "Mixed upload: diagnostic images and report/localizer images together."}
                    </li>
                  )}
                  {data.intake_summary.studyAdequacy === "partial" && data.reportMode !== "FULL_INTERPRETATION_REPORT" && (
                    <li>
                      {language === "tr" ? "Çalışma kısmen yeterli; ek kesitler önerilir." : "Study is partially adequate; additional slices recommended."}
                    </li>
                  )}
                  {data.intake_summary.studyAdequacy === "non-diagnostic" && data.reportMode !== "FULL_INTERPRETATION_REPORT" && (
                    <li>
                      {language === "tr" ? "Yüklenen görüntüler tanısal yorumlama için yeterli değil." : "Uploaded images are not sufficient for diagnostic interpretation."}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Diagnostic sections (hidden for LOCALIZER_DETECTED) */}
          {data.reportType !== "LOCALIZER_DETECTED" && (
          <>
          {/* Red Flags (top priority) */}
          {(data.red_flags?.length ?? 0) > 0 && (
            <Section icon={Flag} title={language === "tr" ? "Kırmızı Bayraklar" : "Red Flags"} accent="red">
              <div className="space-y-1.5">
                {data.red_flags!.map((flag, i) => (
                  <div key={i} className="flex gap-2.5 items-start text-red-300">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Exam Overview */}
          {hasRich && richSections?.exam_overview && (
            <Section icon={ClipboardList} title={language === "tr" ? "İnceleme Özeti" : "Exam Overview"}>
              <p>{richSections.exam_overview}</p>
            </Section>
          )}

          {/* Technical Summary */}
          {hasRich && richSections?.technical_summary && (
            <Section icon={Info} title={language === "tr" ? "Teknik Özet" : "Technical Summary"}>
              <p>{richSections.technical_summary}</p>
            </Section>
          )}

          {/* Study Adequacy Summary */}
          {hasRich && richSections?.study_adequacy_summary && (
            <Section icon={Gauge} title={language === "tr" ? "Çalışma Yeterliliği" : "Study Adequacy"} defaultOpen={true}>
              <p>{richSections.study_adequacy_summary}</p>
            </Section>
          )}

          {/* Anatomical Specificity Summary */}
          {hasRich && richSections?.anatomical_specificity_summary && (
            <Section icon={ClipboardList} title={language === "tr" ? "Anatomik Spesifiklik" : "Anatomical Specificity"} defaultOpen={true}>
              <p>{richSections.anatomical_specificity_summary}</p>
            </Section>
          )}

          {/* Evidence Agreement Summary */}
          {hasRich && richSections?.evidence_agreement_summary && (
            <Section icon={Info} title={language === "tr" ? "Görüntü Uyumu" : "Evidence Agreement"} defaultOpen={true}>
              <p>{richSections.evidence_agreement_summary}</p>
            </Section>
          )}

          {/* AI vs Official Report (Fusion) */}
          {data.report_fusion?.official_report_present && (
            <Section icon={CheckCheck} title={language === "tr" ? "AI ile Resmi Rapor Karşılaştırması" : "AI vs Official Report"} defaultOpen={true}>
              {data.report_fusion.agreement_points?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-emerald-400 mb-1">
                    {language === "tr" ? "Uyumlu bulgular" : "Agreements"}
                  </p>
                  <BulletList items={data.report_fusion.agreement_points} />
                </div>
              )}
              {data.report_fusion.mismatch_points?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-amber-400 mb-1">
                    {language === "tr" ? "Farklılıklar" : "Disagreements"}
                  </p>
                  <ul className="space-y-1.5 ml-1">
                    {data.report_fusion.mismatch_points.map((m, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-theme-text-muted">{language === "tr" ? "AI:" : "AI:"}</span> {m.image_finding}
                        {" | "}
                        <span className="text-theme-text-muted">{language === "tr" ? "Rapor:" : "Report:"}</span> {m.report_finding}
                        {m.note && <span className="block text-xs text-theme-text-muted mt-0.5">— {m.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.report_fusion.official_report_priority_note && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <span className="font-semibold text-amber-400">
                    {language === "tr" ? "Önemli:" : "Important:"}
                  </span> {data.report_fusion.official_report_priority_note}
                </div>
              )}
            </Section>
          )}

          {/* Findings */}
          {detailedFindings.length > 0 && (
            <Section icon={Stethoscope} title={language === "tr" ? "Bulgular" : "Findings"}>
              <BulletList items={detailedFindings} />
            </Section>
          )}

          {/* Findings by Level Summary */}
          {hasRich && richSections?.findings_by_level_summary && (
            <Section icon={ListOrdered} title={language === "tr" ? "Seviye Bazlı Bulgular" : "Findings by Level"} defaultOpen={true}>
              <p>{richSections.findings_by_level_summary}</p>
            </Section>
          )}

          {/* Interpretive Impression */}
          {hasRich && richSections?.interpretive_impression && (
            <Section icon={BookOpen} title={language === "tr" ? "Yorumlayıcı İzlenim" : "Interpretive Impression"}>
              <p>{richSections.interpretive_impression}</p>
            </Section>
          )}

          {/* What Cannot Be Determined */}
          {hasRich && (richSections?.what_cannot_be_determined?.length ?? 0) > 0 && (
            <Section icon={FileQuestion} title={language === "tr" ? "Belirlenemeyenler" : "What Cannot Be Determined"} defaultOpen={true}>
              <BulletList items={richSections!.what_cannot_be_determined!} />
            </Section>
          )}

          {/* Differential Considerations */}
          {(data.differential_considerations?.length ?? 0) > 0 && (
            <Section icon={ListOrdered} title={language === "tr" ? "Olası Açıklamalar" : "Differential Considerations"}>
              <div className="space-y-3">
                {data.differential_considerations!.map((dc, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${LIKELIHOOD_COLORS[dc.likelihood] ?? LIKELIHOOD_COLORS.moderate}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-semibold text-theme-text-primary text-sm">{dc.label}</span>
                      <span className="text-[10px] uppercase tracking-wider opacity-70">[{dc.likelihood}]</span>
                    </div>
                    <p className="text-xs leading-relaxed mb-1">
                      <span className="font-medium">{language === "tr" ? "Neden uyumlu:" : "Why it matches:"}</span> {dc.why_it_matches}
                    </p>
                    <p className="text-xs leading-relaxed opacity-80">
                      <span className="font-medium">{language === "tr" ? "Neden kesin değil:" : "Why not certain:"}</span> {dc.why_not_certain}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Additional Data Requested */}
          {(data.additional_data_requested?.length ?? 0) > 0 && (
            <Section icon={FileQuestion} title={language === "tr" ? "Ek Veri İhtiyacı" : "Additional Data Requested"}>
              <div className="space-y-2">
                {data.additional_data_requested!.map((req, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold mt-0.5 shrink-0 ${PRIORITY_BADGE[req.priority] ?? PRIORITY_BADGE.medium}`}>
                      {req.priority}
                    </span>
                    <div>
                      <span className="font-medium text-theme-text-primary">{req.item}</span>
                      <p className="text-xs text-theme-text-muted mt-0.5">{req.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Important Terms */}
          {(data.important_terms?.length ?? 0) > 0 && (
            <Section icon={BookOpen} title={language === "tr" ? "Önemli Terimler" : "Important Terms"} defaultOpen={false}>
              <div className="space-y-2">
                {data.important_terms!.map((term, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-semibold text-theme-text-primary shrink-0">{term.term}:</span>
                    <span>{term.plain_explanation}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Questions for Doctor */}
          {(data.questions_for_doctor?.length ?? 0) > 0 && (
            <Section icon={Stethoscope} title={language === "tr" ? "Doktora Sorulabilecek Sorular" : "Questions for Your Doctor"}>
              <BulletList items={data.questions_for_doctor!} />
            </Section>
          )}

          {/* Follow-up */}
          {(data.follow_up_considerations?.length ?? 0) > 0 && (
            <Section icon={ClipboardList} title={language === "tr" ? "Takip Değerlendirmeleri" : "Follow-Up Considerations"}>
              <BulletList items={data.follow_up_considerations!} />
            </Section>
          )}

          {/* Limitations */}
          {limitations.length > 0 && (
            <Section icon={AlertTriangle} title={language === "tr" ? "Sınırlamalar" : "Limitations"} defaultOpen={false}>
              <BulletList items={limitations} />
            </Section>
          )}

          {/* Next Steps */}
          {hasRich && (richSections?.next_steps?.length ?? 0) > 0 && (
            <Section icon={ClipboardList} title={language === "tr" ? "Sonraki Adımlar" : "Next Steps"}>
              <BulletList items={richSections!.next_steps!} />
            </Section>
          )}

          {/* Confidence Assessment */}
          {(data.confidence_level || data.confidence > 0 || (data.confidence_reasons?.length ?? 0) > 0) && (
            <Section icon={Gauge} title={language === "tr" ? "Güvenilirlik Değerlendirmesi" : "Confidence Assessment"} defaultOpen={false}>
              {(data.confidence_level || data.confidence > 0) && (
                <p className="font-medium text-theme-text-primary">
                  {language === "tr" ? "Güvenilirlik Düzeyi" : "Confidence Level"}: {data.confidence_level || getConfidenceLabel(data.confidence, language as "tr" | "en")}
                  {data.confidence > 0 && ` (${data.confidence}%)`}
                </p>
              )}
              {(data.confidence_reasons?.length ?? 0) > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-theme-text-muted mb-1">{language === "tr" ? "Nedenleri:" : "Reasons:"}</p>
                  <BulletList items={data.confidence_reasons!} />
                </div>
              )}
            </Section>
          )}

          {/* Literature Support */}
          {(data.literature_support?.length ?? 0) > 0 && (
            <Section icon={Library} title={language === "tr" ? "Literatür Desteği" : "Literature Support"} defaultOpen={false}>
              <div className="space-y-2">
                {data.literature_support!.map((lit, i) => (
                  <div key={i} className="text-xs">
                    <p className="font-medium text-theme-text-primary">{lit.title}</p>
                    <p className="text-theme-text-muted">{lit.source}, {lit.year} {lit.relevance ? `\u2014 ${lit.relevance}` : ""}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recommended Actions (legacy fallback) */}
          {!hasRich && !data.questions_for_doctor?.length && data.recommended_actions?.length > 0 && (
            <Section icon={ClipboardList} title={t("action_plan")}>
              <BulletList items={data.recommended_actions} />
            </Section>
          )}

          {/* Medical Disclaimer */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-theme-text-muted leading-relaxed">
            <span className="font-semibold text-amber-500/80 mr-1">
              {language === "tr" ? "Tıbbi Uyarı:" : "Medical Disclaimer:"}
            </span>
            {data.medical_disclaimer || (language === "tr"
              ? "Bu çıktı bilgilendirme amaçlıdır. Kesin tanı ve tedavi için uzman hekim değerlendirmesi gereklidir."
              : "This output is for informational purposes only and does not replace medical advice from a licensed clinician.")}
          </div>

          {/* References (legacy fallback) */}
          {data.references?.length > 0 && !data.medical_disclaimer && (
            <div>
              <label className="text-label mb-2 block text-xs uppercase tracking-wide text-theme-text-muted">{t("references") || "References"}</label>
              <div className="space-y-1">
                {data.references.map((ref, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-theme-text-secondary">
                    <span className="text-[10px] font-bold text-theme-text-muted mt-0.5">[{idx + 1}]</span>
                    <span className="italic">{ref}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* ── FOOTER ACTIONS ── */}
      {pdfError && <p className="text-sm text-theme-danger mt-2" role="alert">{pdfError}</p>}
      <div className="flex gap-3 pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={() => generatePDF("download")}
          disabled={isGeneratingPdf}
          className="flex-1 bg-theme-accent hover:bg-theme-accent/90 text-theme-accent-foreground py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingPdf ? <Activity className="w-4 h-4 animate-spin" /> : <Download size={18} />}
          {isGeneratingPdf ? t("generating_pdf") : t("export_report")}
        </button>
        <button
          onClick={() => generatePDF("view")}
          disabled={isGeneratingPdf}
          className="flex-1 bg-theme-surface hover:bg-theme-surface-elevated text-theme-text-primary border border-theme-border py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingPdf ? <Activity className="w-4 h-4 animate-spin" /> : <Eye size={18} />}
          {isGeneratingPdf ? t("generating_pdf") : t("view_pdf")}
        </button>
      </div>
    </motion.div>
  );
}
