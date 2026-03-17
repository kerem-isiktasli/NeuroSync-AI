/**
 * Domain-specific image analyzers — unified entry point.
 * Each analyzer consumes actual image content and returns schema-compatible findings.
 */
export { analyzeBrain, analyzeBrainStudy, aggregateBrainSlices } from "./brainAnalyzer";
export { analyzeChest, analyzeChestStudy, aggregateChestSlices } from "./chestAnalyzer";
export { analyzeSpine, analyzeSpineStudy, aggregateSpineSlices } from "./spineAnalyzer";
export { analyzeAbdomen, analyzeAbdomenStudy, aggregateAbdomenSlices } from "./abdomenAnalyzer";
export type { PerSliceObservation, StudyAggregation, AnalyzerResult } from "./types";
export type { DomainFindingSchema } from "./types";
import type { MedicalDomain } from "../domainRouter";
import type { DomainFinding } from "../domainSchemas";
import { analyzeBrain } from "./brainAnalyzer";
import { analyzeChest } from "./chestAnalyzer";
import { analyzeSpine } from "./spineAnalyzer";
import { analyzeAbdomen } from "./abdomenAnalyzer";

export interface AnalyzeImageOptions {
  modality?: string;
  anatomicalRegion?: string;
  language?: "tr" | "en";
}

/** Dispatch analysis to the appropriate domain analyzer. */
export async function analyzeImageByDomain(
  domain: MedicalDomain,
  imageBase64: string,
  options?: AnalyzeImageOptions
): Promise<{ findings: DomainFinding; confidence: number; limitations: string[]; evidenceSummary: string } | null> {
  const language = options?.language ?? "en";
  const opts = { modality: options?.modality, anatomicalRegion: options?.anatomicalRegion };

  try {
    switch (domain) {
      case "brain": {
        const r = await analyzeBrain(imageBase64, language, opts);
        return {
          findings: r.findings,
          confidence: r.confidence,
          limitations: r.limitations,
          evidenceSummary: r.evidenceSummary,
        };
      }
      case "chest": {
        const r = await analyzeChest(imageBase64, language, opts);
        return {
          findings: r.findings,
          confidence: r.confidence,
          limitations: r.limitations,
          evidenceSummary: r.evidenceSummary,
        };
      }
      case "spine": {
        const r = await analyzeSpine(imageBase64, language, opts);
        return {
          findings: r.findings,
          confidence: r.confidence,
          limitations: r.limitations,
          evidenceSummary: r.evidenceSummary,
        };
      }
      case "abdomen-pelvis": {
        const r = await analyzeAbdomen(imageBase64, language, opts);
        return {
          findings: r.findings,
          confidence: r.confidence,
          limitations: r.limitations,
          evidenceSummary: r.evidenceSummary,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
