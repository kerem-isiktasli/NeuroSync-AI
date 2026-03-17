/**
 * Domain Analyzer Types — per-slice, study-level, confidence, evidence.
 */
import type {
  BrainFindingSchema,
  ChestFindingSchema,
  SpineFindingSchema,
  AbdomenFindingSchema,
} from "../domainSchemas";

export type DomainFindingSchema =
  | BrainFindingSchema
  | ChestFindingSchema
  | SpineFindingSchema
  | AbdomenFindingSchema;

/** Per-slice observation from a single image analysis. */
export interface PerSliceObservation<T extends DomainFindingSchema = DomainFindingSchema> {
  sliceIndex: number;
  totalSlices: number;
  findings: T;
  confidence: number;
  limitations: string[];
  evidenceSummary?: string;
}

/** Study-level aggregation of multiple slice observations. */
export interface StudyAggregation<T extends DomainFindingSchema = DomainFindingSchema> {
  studyLevelFindings: T;
  perSliceObservations: PerSliceObservation<T>[];
  aggregatedConfidence: number;
  aggregatedLimitations: string[];
  evidenceSummary: string;
}

/** Single-image analyzer result. */
export interface AnalyzerResult<T extends DomainFindingSchema = DomainFindingSchema> {
  findings: T;
  perSliceObservations?: PerSliceObservation<T>[];
  studyAggregation?: StudyAggregation<T>;
  confidence: number;
  limitations: string[];
  evidenceSummary: string;
}
