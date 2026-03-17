/**
 * Brain Analyzer Tests — structured output, confidence, limitations, aggregation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeBrain,
  analyzeBrainStudy,
  aggregateBrainSlices,
} from "../brainAnalyzer";
import type { PerSliceObservation } from "../types";
import type { BrainFindingSchema } from "../../domainSchemas";

vi.mock("@/lib/googleHealthcare", () => ({
  googleHealthcare: {
    runDomainStructuredAnalysis: vi.fn(),
  },
}));

import { googleHealthcare } from "@/lib/googleHealthcare";

const mockRunDomainStructuredAnalysis = googleHealthcare.runDomainStructuredAnalysis as ReturnType<
  typeof vi.fn
>;

const MOCK_BRAIN_RESPONSE: Record<string, unknown> = {
  lesionLocalization: [{ region: "Frontal", finding: "No focal lesion." }],
  hemorrhageEdemaMassEffect: ["Mass effect not seen."],
  ventricularFindings: ["Ventricles normal."],
  extraAxialFindings: ["Extra-axial collection not seen."],
  abnormalities: ["Symmetry preserved."],
  impression: "No significant intracranial abnormality.",
  recommendedNextSteps: ["Routine follow-up per clinical indication."],
  confidence: 85,
  limitations: ["Single slice; limited coverage."],
  evidenceSummary: "Image analysis based on provided slice.",
};

describe("Brain Analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeBrain", () => {
    it("returns BrainFindingSchema-compatible structure", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue(MOCK_BRAIN_RESPONSE);

      const result = await analyzeBrain("base64...", "en");

      expect(result.findings.domain).toBe("brain");
      expect(result.findings.lesionLocalization).toHaveLength(1);
      expect(result.findings.lesionLocalization[0].region).toBe("Frontal");
      expect(result.findings.ventricularFindings).toContain("Ventricles normal.");
      expect(result.findings.hemorrhageEdemaMassEffect).toContain("Mass effect not seen.");
      expect(result.findings.extraAxialFindings).toContain("Extra-axial collection not seen.");
      expect(result.findings.impression).toBe("No significant intracranial abnormality.");
      expect(result.findings.recommendedNextSteps).toContain(
        "Routine follow-up per clinical indication."
      );
    });

    it("propagates confidence and limitations", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue({
        ...MOCK_BRAIN_RESPONSE,
        confidence: 72,
        limitations: ["Low resolution.", "Motion artifact."],
      });

      const result = await analyzeBrain("base64...", "en");

      expect(result.confidence).toBe(72);
      expect(result.limitations).toContain("Low resolution.");
      expect(result.limitations).toContain("Motion artifact.");
    });

    it("includes per-slice observations for single image", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue(MOCK_BRAIN_RESPONSE);

      const result = await analyzeBrain("base64...", "en");

      expect(result.perSliceObservations).toHaveLength(1);
      expect(result.perSliceObservations![0].sliceIndex).toBe(0);
      expect(result.perSliceObservations![0].totalSlices).toBe(1);
      expect(result.perSliceObservations![0].confidence).toBe(85);
    });
  });

  describe("aggregateBrainSlices", () => {
    it("aggregates per-slice observations into study-level findings", () => {
      const obs1: PerSliceObservation<BrainFindingSchema> = {
        sliceIndex: 0,
        totalSlices: 2,
        findings: {
          domain: "brain",
          lesionLocalization: [{ region: "Frontal", finding: "No lesion." }],
          hemorrhageEdemaMassEffect: ["Mass effect not seen."],
          ventricularFindings: ["Ventricles normal."],
          extraAxialFindings: [],
          abnormalities: ["Slice 1 normal."],
          impression: "Normal.",
          recommendedNextSteps: [],
        },
        confidence: 80,
        limitations: ["Slice 1 limited."],
      };
      const obs2: PerSliceObservation<BrainFindingSchema> = {
        sliceIndex: 1,
        totalSlices: 2,
        findings: {
          domain: "brain",
          lesionLocalization: [{ region: "Occipital", finding: "Hypodensity." }],
          hemorrhageEdemaMassEffect: ["Hemorrhage suspected."],
          ventricularFindings: ["Ventricular enlargement."],
          extraAxialFindings: ["Subdural suspected."],
          abnormalities: ["Abnormality slice 2."],
          impression: "Abnormality.",
          recommendedNextSteps: ["Urgent correlation."],
        },
        confidence: 60,
        limitations: ["Artifact."],
      };

      const agg = aggregateBrainSlices([obs1, obs2]);

      expect(agg.studyLevelFindings.domain).toBe("brain");
      expect(agg.studyLevelFindings.lesionLocalization.length).toBeGreaterThan(0);
      expect(agg.studyLevelFindings.hemorrhageEdemaMassEffect).toContain("Mass effect not seen.");
      expect(agg.studyLevelFindings.hemorrhageEdemaMassEffect).toContain("Hemorrhage suspected.");
      expect(agg.studyLevelFindings.ventricularFindings).toContain("Ventricles normal.");
      expect(agg.studyLevelFindings.ventricularFindings).toContain("Ventricular enlargement.");
      expect(agg.studyLevelFindings.recommendedNextSteps).toContain(
        "Urgent clinical correlation and possible follow-up imaging."
      );
      expect(agg.aggregatedConfidence).toBe(70);
      expect(agg.aggregatedLimitations).toContain("Slice 1 limited.");
      expect(agg.aggregatedLimitations).toContain("Artifact.");
      expect(agg.evidenceSummary).toContain("2 slice(s)");
    });

    it("returns empty structure for no observations", () => {
      const agg = aggregateBrainSlices([]);

      expect(agg.studyLevelFindings.domain).toBe("brain");
      expect(agg.studyLevelFindings.lesionLocalization[0].finding).toBe("No observations.");
      expect(agg.aggregatedConfidence).toBe(0);
      expect(agg.aggregatedLimitations).toContain("No slices to aggregate.");
    });
  });

  describe("analyzeBrainStudy", () => {
    it("aggregates multiple slices with study-level findings", async () => {
      mockRunDomainStructuredAnalysis
        .mockResolvedValueOnce({ ...MOCK_BRAIN_RESPONSE, confidence: 80 })
        .mockResolvedValueOnce({
          ...MOCK_BRAIN_RESPONSE,
          lesionLocalization: [{ region: "Parietal", finding: "Focal finding." }],
          confidence: 75,
        });

      const result = await analyzeBrainStudy(["base64-1", "base64-2"], "en");

      expect(result.perSliceObservations).toHaveLength(2);
      expect(result.studyAggregation).toBeDefined();
      expect(result.studyAggregation!.perSliceObservations).toHaveLength(2);
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      expect(result.confidence).toBeLessThanOrEqual(80);
      expect(result.findings.domain).toBe("brain");
    });

    it("returns empty result for no images", async () => {
      const result = await analyzeBrainStudy([], "en");

      expect(result.findings.impression).toContain("no images");
      expect(result.confidence).toBe(0);
      expect(result.limitations).toContain("No images provided.");
      expect(mockRunDomainStructuredAnalysis).not.toHaveBeenCalled();
    });
  });
});
