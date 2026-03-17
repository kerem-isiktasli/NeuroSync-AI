/**
 * Localizer report generator — produces structured non-diagnostic report
 * when MRI/CT localizer (scout) images are detected.
 */

import type { LocalizerDetectionResult } from "./localizerDetection";

export interface LocalizerReport {
  reportType: "LOCALIZER_DETECTED";
  interpretation: string;
  explanation: string;
  recommendation: string[];
  detectedIndicators: string[];
  confidence: number;
}

/**
 * Generates the structured localizer report for UI display.
 */
export function generateLocalizerReport(detection: LocalizerDetectionResult): LocalizerReport {
  const defaultIndicators = [
    "OCR keyword: localizer",
    "Low slice count",
    "Non-diagnostic anatomy structure",
  ];

  const indicators =
    detection.detectedIndicators.length > 0
      ? detection.detectedIndicators
      : defaultIndicators;

  return {
    reportType: "LOCALIZER_DETECTED",
    interpretation:
      "These images appear to be MRI/CT localizer (scout) images.",
    explanation:
      "Localizer images are positioning scans used to align the study and do not contain sufficient diagnostic detail for medical interpretation.",
    recommendation: [
      "Upload diagnostic MRI/CT slices instead.",
      "Recommended sequences include sagittal, axial, or coronal views.",
      "If possible upload the full DICOM study.",
    ],
    detectedIndicators: indicators,
    confidence: detection.confidence,
  };
}

/** Builds FinalResponse-compatible object from localizer report for API. */
export function localizerReportToFinalResponse(
  report: LocalizerReport,
  language: "tr" | "en"
): Record<string, unknown> {
  const tr = language === "tr";
  const recommendationText = report.recommendation.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return {
    reportType: "LOCALIZER_DETECTED",
    /** First-class localizer payload for UI/PDF/chat — not compressed. */
    localizerReport: {
      interpretation: report.interpretation,
      explanation: report.explanation,
      recommendation: [...report.recommendation],
      detectedIndicators: [...report.detectedIndicators],
      confidence: report.confidence,
    },
    summary: report.interpretation,
    key_findings: [report.explanation, ...report.recommendation],
    important_terms: [],
    concern_level: "low",
    possible_context: report.explanation,
    differential_considerations: [],
    additional_data_requested: report.recommendation.map((item) => ({
      item,
      reason: report.explanation,
      priority: "high" as const,
    })),
    red_flags: [],
    literature_support: [],
    questions_for_doctor: tr ? ["Tam MRI/CT serisi nasıl paylaşılır?"] : ["How do I share my full MRI/CT series?"],
    follow_up_considerations: report.recommendation,
    medical_disclaimer: tr ? "Bu çıktı bilgilendirme amaçlıdır." : "This output is for informational purposes only.",
    modality: "",
    anatomical_region: "",
    professional_report_markdown: [
      `## ${report.interpretation}`,
      "",
      report.explanation,
      "",
      "### Recommendations",
      recommendationText,
      "",
      `*Detected indicators: ${report.detectedIndicators.join(", ")}*`,
    ].join("\n"),
    report_sections: {
      exam_overview: report.interpretation,
      technical_summary: "",
      detailed_findings: [],
      interpretive_impression: report.explanation,
      limitations: report.detectedIndicators,
      next_steps: report.recommendation,
    },
  };
}
