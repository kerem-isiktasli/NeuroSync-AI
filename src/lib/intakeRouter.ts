/**
 * Intake-aware routing engine — v2.
 *
 * Combines PatientProfile + AnalysisIntake + FileInspection
 * to produce an explicit, traceable routing decision.
 */

import type {
  CombinedRoutingContext,
  RoutingDecision,
  RoutingPipeline,
  BodyRegion,
  FileType,
} from "@/types/intake";

const REGION_TO_DOMAIN: Record<BodyRegion, string> = {
  "brain": "neuro",
  "c-spine": "spine",
  "t-spine": "spine",
  "l-spine": "spine",
  "chest": "chest",
  "abdomen": "abdomen",
  "pelvis": "abdomen",
  "shoulder": "msk",
  "elbow": "msk",
  "wrist-hand": "msk",
  "hip": "msk",
  "knee": "msk",
  "ankle-foot": "msk",
  "whole-body": "general-radiology",
  "other": "general-radiology",
};

function pipelineFromFileType(ft: FileType | null): RoutingPipeline | null {
  switch (ft) {
    case "blood-test":
    case "pathology":
    case "doctor-report":
      return "document-report";
    case "mri":
    case "ct":
    case "x-ray":
    case "ultrasound":
      return "image-analysis";
    case "mixed":
    case "not-sure":
    case null:
      return null;
  }
}

export function computeRoutingDecision(ctx: CombinedRoutingContext): RoutingDecision {
  const { profile, intake, fileInspection } = ctx;
  const reasons: string[] = [];
  const conflicts: string[] = [];

  // ── 1. Pipeline ──
  let pipeline: RoutingPipeline = "image-analysis";

  const intakePipeline = pipelineFromFileType(intake.fileType);
  if (intakePipeline) {
    pipeline = intakePipeline;
    reasons.push(`Pipeline from intake fileType=${intake.fileType} → ${pipeline}`);
  }

  if (fileInspection.dicomDetected) {
    if (intakePipeline && intakePipeline !== "dicom-study") {
      conflicts.push(`Intake says ${intake.fileType} but DICOM detected`);
    }
    pipeline = "dicom-study";
    reasons.push("DICOM detected → dicom-study");
  } else if (fileInspection.pdfDetected && !fileInspection.screenshotDetected && fileInspection.fileCount === 1) {
    if (pipeline === "image-analysis") {
      pipeline = "document-report";
      reasons.push("Single PDF → document-report");
    }
  }

  if (intake.uploadFormat === "screenshots" || intake.studyCompleteness === "selected-images") {
    if (pipeline === "image-analysis") {
      pipeline = "limited-image-analysis";
      reasons.push("Screenshots/selected images → limited-image-analysis");
    }
  }

  // ── 2. Domain ──
  let domain = "general-radiology";
  let bodyRegionSource: RoutingDecision["bodyRegionSource"] = "unknown";

  if (intake.bodyRegion && intake.bodyRegion !== "other") {
    domain = REGION_TO_DOMAIN[intake.bodyRegion] ?? "general-radiology";
    bodyRegionSource = "intake";
    reasons.push(`Domain from intake bodyRegion=${intake.bodyRegion} → ${domain}`);
  } else if (profile.commonBodyRegions.length > 0) {
    domain = REGION_TO_DOMAIN[profile.commonBodyRegions[0]] ?? "general-radiology";
    bodyRegionSource = "profile-history";
    reasons.push(`Domain from profile commonBodyRegions → ${domain}`);
  } else if (fileInspection.detectedBodyRegionGuess && fileInspection.detectedBodyRegionConfidence >= 50) {
    domain = fileInspection.detectedBodyRegionGuess;
    bodyRegionSource = "file-inspection";
    reasons.push(`Domain from file inspection → ${domain}`);
  }

  if (
    intake.bodyRegion &&
    fileInspection.detectedBodyRegionGuess &&
    fileInspection.detectedBodyRegionConfidence >= 60
  ) {
    const intakeDomain = REGION_TO_DOMAIN[intake.bodyRegion] ?? "general-radiology";
    if (intakeDomain !== fileInspection.detectedBodyRegionGuess && intakeDomain !== "general-radiology") {
      conflicts.push(`Intake=${intake.bodyRegion} but file says ${fileInspection.detectedBodyRegionGuess}. Using intake.`);
    }
  }

  // ── 3. Confidence ──
  let confidenceLevel: RoutingDecision["confidenceLevel"] = "medium";
  const hasRegion = !!intake.bodyRegion;
  const hasType = !!intake.fileType;
  const hasConcern = intake.primaryConcern.length > 3;

  if (hasRegion && hasType && hasConcern) {
    confidenceLevel = "high";
    reasons.push("High confidence: region + fileType + concern present");
  } else if (!hasRegion && !hasType) {
    confidenceLevel = "low";
    reasons.push("Low confidence: no intake region or fileType");
  }

  if (intake.uploadFormat === "screenshots" || intake.studyCompleteness === "selected-images") {
    if (confidenceLevel === "high") confidenceLevel = "medium";
    reasons.push("Confidence lowered: screenshots/selected");
  }

  if (fileInspection.technicalQualityEstimate === "low") {
    if (confidenceLevel === "high") confidenceLevel = "medium";
    reasons.push("Confidence lowered: low quality");
  }

  // ── 4. Report style ──
  let reportStyle: RoutingDecision["reportStyle"] = "full";

  if (pipeline === "limited-image-analysis") reportStyle = "limited";
  else if (pipeline === "document-report") reportStyle = "explanation";

  if (intake.studyTimeline === "follow-up" && intake.priorRelatedStudies === "yes") {
    reportStyle = "comparison";
    reasons.push("Follow-up + prior studies → comparison");
  }
  if (intake.desiredOutput.includes("comparison")) {
    reportStyle = "comparison";
    reasons.push("Patient requested comparison");
  }

  // ── 5. Safety ──
  let safetyLevel: RoutingDecision["safetyLevel"] = "standard";

  if (intake.hasBowelBladderChanges || intake.hasSaddleNumbness) {
    safetyLevel = "elevated";
    reasons.push("Elevated safety: cauda equina red flags");
  }

  const seriousKeywords = ["cancer", "tumor", "malignant", "kanser", "tümör"];
  const allConditions = [...profile.knownDiagnoses, ...profile.chronicConditions, ...profile.activeFollowUpDiagnoses];
  if (allConditions.some(d => seriousKeywords.some(k => d.toLowerCase().includes(k)))) {
    safetyLevel = "elevated";
    reasons.push("Elevated safety: serious condition in profile");
  }

  return { pipeline, domain, confidenceLevel, bodyRegionSource, reportStyle, safetyLevel, reasons, conflicts };
}

export function inspectFiles(files: File[]): import("@/types/intake").FileInspectionContext {
  const mimeTypes = [...new Set(files.map(f => f.type || "application/octet-stream"))];
  const extensions = files.map(f => f.name.split(".").pop()?.toLowerCase() ?? "");

  return {
    actualMimeTypes: mimeTypes,
    dicomDetected: extensions.some(e => e === "dcm") || mimeTypes.some(m => m.includes("dicom")),
    pdfDetected: extensions.some(e => e === "pdf") || mimeTypes.includes("application/pdf"),
    screenshotDetected: mimeTypes.some(m => m.startsWith("image/")),
    fileCount: files.length,
    detectedSeriesType: null,
    detectedBodyRegionGuess: null,
    detectedBodyRegionConfidence: 0,
    technicalQualityEstimate: "unknown",
  };
}
