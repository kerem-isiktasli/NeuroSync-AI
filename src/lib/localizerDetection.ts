/**
 * Localizer (scout) image detection for MRI/CT.
 * Detects non-diagnostic positioning scans early to avoid running full AI interpretation.
 */

import type { PerImageIntakeResult } from "./ai/intakePrompts";
import type { StudyIntakeSummary } from "./ai/studyIntake";

export type SequenceType = "LOCALIZER" | "DIAGNOSTIC";

export interface LocalizerDetectionResult {
  sequenceType: SequenceType;
  confidence: number;
  detectedIndicators: string[];
}

/** OCR keywords that indicate localizer/scout images. */
const LOCALIZER_OCR_KEYWORDS = [
  "localizer",
  "scout",
  "survey",
  "topogram",
  "locator",
];

const SLICE_COUNT_THRESHOLD = 10;

/**
 * Checks if OCR/text contains any localizer-indicating keywords.
 */
function hasLocalizerOcrKeyword(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase().trim();
  return LOCALIZER_OCR_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Returns true if anatomy confidence is low based on diagnostic_value.
 */
function isAnatomyConfidenceLow(perImage: PerImageIntakeResult[]): boolean {
  if (!perImage.length) return true;
  const lowValues = new Set(["low", "none"]);
  const lowCount = perImage.filter((p) => lowValues.has(p.diagnostic_value)).length;
  return lowCount >= perImage.length * 0.8; // 80% or more have low/none
}

/**
 * Detects localizer sequences using multiple signals.
 *
 * Part 5 (false-positive prevention): Only LOCALIZER if:
 * 1. OCR contains "localizer / scout / survey" OR
 * 2. sliceCount < 10 AND anatomy confidence low
 */
export function detectLocalizerSequence(params: {
  images: Array<{ imageBase64?: string; fileName?: string }>;
  perImageIntake?: PerImageIntakeResult[];
  intakeSummary?: StudyIntakeSummary;
  ocrTextByIndex?: Record<number, string>;
  /** Pre-extracted OCR text from first image(s) - merged string */
  ocrText?: string;
}): LocalizerDetectionResult {
  const {
    images,
    perImageIntake,
    intakeSummary,
    ocrTextByIndex,
    ocrText,
  } = params;

  const sliceCount = images.length;
  const detectedIndicators: string[] = [];
  let confidence = 0;

  // Collect OCR text from all sources
  let combinedOcr = ocrText ?? "";
  if (ocrTextByIndex && Object.keys(ocrTextByIndex).length > 0) {
    combinedOcr += "\n" + Object.values(ocrTextByIndex).filter(Boolean).join("\n");
  }

  const hasOcrKeyword = hasLocalizerOcrKeyword(combinedOcr);
  const sliceCountLow = sliceCount < SLICE_COUNT_THRESHOLD;
  const anatomyLow = perImageIntake ? isAnatomyConfidenceLow(perImageIntake) : false;
  const studyLocalizerOnly = intakeSummary?.studyAdequacy === "localizer-only";
  const localizerCount = intakeSummary?.localizerCount ?? 0;
  const allLocalizerByIntake =
    perImageIntake &&
    perImageIntake.length > 0 &&
    perImageIntake.every((p) => p.upload_type === "localizer");

  // Rule 1: OCR contains localizer/scout/survey → strong LOCALIZER
  if (hasOcrKeyword) {
    detectedIndicators.push('OCR keyword: localizer/scout/survey/topogram/locator');
    confidence = Math.max(confidence, 0.9);
  }

  // Rule 2: sliceCount < 10 AND anatomy confidence low
  if (sliceCountLow && anatomyLow) {
    detectedIndicators.push("Low slice count");
    detectedIndicators.push("Non-diagnostic anatomy structure");
    confidence = Math.max(confidence, hasOcrKeyword ? 0.95 : 0.75);
  }

  // Intake signals (reinforcement)
  if (studyLocalizerOnly || allLocalizerByIntake) {
    if (!detectedIndicators.some((i) => i.includes("Localizer-only"))) {
      detectedIndicators.push("Localizer-only study (intake)");
    }
    confidence = Math.max(confidence, 0.85);
  }

  if (localizerCount > 0 && localizerCount >= sliceCount * 0.8) {
    if (!detectedIndicators.some((i) => i.includes("Low slice count"))) {
      detectedIndicators.push(`High localizer ratio (${localizerCount}/${sliceCount})`);
    }
  }

  // Final classification per Part 5: only LOCALIZER if at least one rule satisfied
  const isLocalizer =
    hasOcrKeyword ||
    (sliceCountLow && anatomyLow);

  if (!isLocalizer) {
    return {
      sequenceType: "DIAGNOSTIC",
      confidence: 0,
      detectedIndicators: [],
    };
  }

  return {
    sequenceType: "LOCALIZER",
    confidence: Math.min(0.99, confidence),
    detectedIndicators: [...new Set(detectedIndicators)],
  };
}
