/**
 * Universal Output Wrapper — Consistent result structure across all pipelines.
 * Ensures the result reflects what was actually analyzed.
 */

import type { AdequacyTier } from "./types";

export interface UniversalOutputMeta {
  inputType: string;
  domain: string;
  modality: string;
  anatomicalRegion: string;
  adequacyTier: AdequacyTier;
  confidence: number;
  whatWasActuallyAnalyzed: string[];
  whatCouldNotBeDetermined: string[];
  structuredDomainResult?: Record<string, unknown>;
  nextBestUploads: string[];
  pipeline: string;
}

export interface UniversalOutput {
  userFacingSummary: string;
  meta: UniversalOutputMeta;
}

/**
 * Build meta for limited/insufficient cases — prevents fake-normal reports.
 */
export function buildLimitedOutputMeta(params: {
  inputType: string;
  domain: string;
  adequacyTier: AdequacyTier;
  whatWasAnalyzed: string[];
  whatCouldNotBeDetermined: string[];
  nextBestUploads: string[];
  pipeline: string;
  language?: "tr" | "en";
}): UniversalOutputMeta {
  const { inputType, domain, adequacyTier, whatWasAnalyzed, whatCouldNotBeDetermined, nextBestUploads, pipeline } = params;
  return {
    inputType,
    domain,
    modality: "",
    anatomicalRegion: "",
    adequacyTier,
    confidence: adequacyTier === "insufficient" ? 20 : adequacyTier === "limited" ? 45 : 60,
    whatWasActuallyAnalyzed: whatWasAnalyzed,
    whatCouldNotBeDetermined: whatCouldNotBeDetermined,
    nextBestUploads,
    pipeline,
  };
}
