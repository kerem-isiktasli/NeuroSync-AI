/**
 * Chest Analyzer Tests — structured output, confidence, limitations, aggregation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeChest,
  analyzeChestStudy,
  aggregateChestSlices,
} from "../chestAnalyzer";
import type { PerSliceObservation } from "../types";
import type { ChestFindingSchema } from "../../domainSchemas";

vi.mock("@/lib/googleHealthcare", () => ({
  googleHealthcare: {
    runDomainStructuredAnalysis: vi.fn(),
  },
}));

import { googleHealthcare } from "@/lib/googleHealthcare";

const mockRunDomainStructuredAnalysis = googleHealthcare.runDomainStructuredAnalysis as ReturnType<
  typeof vi.fn
>;

const MOCK_CHEST_RESPONSE: Record<string, unknown> = {
  lungLobeFindings: [{ lobe: "RUL", finding: "No focal opacity." }],
  pleuraEffusionConsolidation: ["Pleural effusion not seen."],
  noduleFindings: [],
  mediastinumFindings: ["Gross mediastinal abnormality not seen."],
  abnormalities: ["Lung fields clear."],
  impression: "No significant thoracic abnormality.",
  recommendedNextSteps: ["Routine follow-up per clinical indication."],
  confidence: 88,
  limitations: ["Single view."],
  evidenceSummary: "Chest image analysis performed.",
};

describe("Chest Analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeChest", () => {
    it("returns ChestFindingSchema-compatible structure", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue(MOCK_CHEST_RESPONSE);

      const result = await analyzeChest("base64...", "en");

      expect(result.findings.domain).toBe("chest");
      expect(result.findings.lungLobeFindings[0].lobe).toBe("RUL");
      expect(result.findings.pleuraEffusionConsolidation).toContain("Pleural effusion not seen.");
      expect(result.findings.mediastinumFindings).toContain("Gross mediastinal abnormality not seen.");
      expect(result.findings.impression).toBe("No significant thoracic abnormality.");
    });

    it("propagates confidence and limitations", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue({
        ...MOCK_CHEST_RESPONSE,
        confidence: 55,
        limitations: ["Rotation.", "Incomplete lung bases."],
      });

      const result = await analyzeChest("base64...", "en");

      expect(result.confidence).toBe(55);
      expect(result.limitations).toContain("Rotation.");
    });
  });

  describe("aggregateChestSlices", () => {
    it("aggregates per-slice observations into study-level findings", () => {
      const obs: PerSliceObservation<ChestFindingSchema> = {
        sliceIndex: 0,
        totalSlices: 1,
        findings: {
          domain: "chest",
          lungLobeFindings: [{ lobe: "General", finding: "Consolidation suspected." }],
          pleuraEffusionConsolidation: ["Effusion suspected."],
          noduleFindings: ["Nodule RUL."],
          mediastinumFindings: [],
          abnormalities: ["Abnormality."],
          impression: "Abnormal.",
          recommendedNextSteps: [],
        },
        confidence: 70,
        limitations: [],
      };

      const agg = aggregateChestSlices([obs]);

      expect(agg.studyLevelFindings.domain).toBe("chest");
      expect(agg.studyLevelFindings.pleuraEffusionConsolidation).toContain("Effusion suspected.");
      expect(agg.studyLevelFindings.noduleFindings).toContain("Nodule RUL.");
      expect(agg.aggregatedConfidence).toBe(70);
    });

    it("returns empty structure for no observations", () => {
      const agg = aggregateChestSlices([]);
      expect(agg.studyLevelFindings.domain).toBe("chest");
      expect(agg.aggregatedConfidence).toBe(0);
    });
  });

  describe("analyzeChestStudy", () => {
    it("returns empty result for no images", async () => {
      const result = await analyzeChestStudy([], "en");
      expect(result.findings.impression).toContain("no images");
      expect(result.confidence).toBe(0);
      expect(mockRunDomainStructuredAnalysis).not.toHaveBeenCalled();
    });
  });
});
