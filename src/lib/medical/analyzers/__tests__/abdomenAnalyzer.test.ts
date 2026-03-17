/**
 * Abdomen/Pelvis Analyzer Tests — structured output, confidence, limitations, aggregation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeAbdomen,
  analyzeAbdomenStudy,
  aggregateAbdomenSlices,
} from "../abdomenAnalyzer";
import type { PerSliceObservation } from "../types";
import type { AbdomenFindingSchema } from "../../domainSchemas";

vi.mock("@/lib/googleHealthcare", () => ({
  googleHealthcare: {
    runDomainStructuredAnalysis: vi.fn(),
  },
}));

import { googleHealthcare } from "@/lib/googleHealthcare";

const mockRunDomainStructuredAnalysis = googleHealthcare.runDomainStructuredAnalysis as ReturnType<
  typeof vi.fn
>;

const MOCK_ABDOMEN_RESPONSE: Record<string, unknown> = {
  organFindings: [
    { organ: "Liver", finding: "No focal lesion." },
    { organ: "Spleen", finding: "Normal." },
  ],
  liverFindings: ["Liver unremarkable."],
  kidneyFindings: ["Kidneys normal."],
  bowelBladderFindings: ["No bowel distension."],
  abnormalities: ["Gross organ overview unremarkable."],
  impression: "No significant abdominal abnormality.",
  recommendedNextSteps: ["Routine follow-up per clinical indication."],
  confidence: 78,
  limitations: ["Contrast timing suboptimal."],
  evidenceSummary: "Abdomen image analysis performed.",
};

describe("Abdomen Analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeAbdomen", () => {
    it("returns AbdomenFindingSchema-compatible structure", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue(MOCK_ABDOMEN_RESPONSE);

      const result = await analyzeAbdomen("base64...", "en");

      expect(result.findings.domain).toBe("abdomen-pelvis");
      expect(result.findings.organFindings).toHaveLength(2);
      expect(result.findings.organFindings[0].organ).toBe("Liver");
      expect(result.findings.liverFindings).toContain("Liver unremarkable.");
      expect(result.findings.kidneyFindings).toContain("Kidneys normal.");
      expect(result.findings.impression).toBe("No significant abdominal abnormality.");
    });

    it("propagates confidence and limitations", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue({
        ...MOCK_ABDOMEN_RESPONSE,
        confidence: 55,
        limitations: ["Motion.", "Incomplete coverage."],
      });

      const result = await analyzeAbdomen("base64...", "en");

      expect(result.confidence).toBe(55);
      expect(result.limitations).toContain("Motion.");
    });
  });

  describe("aggregateAbdomenSlices", () => {
    it("aggregates per-slice observations into study-level findings", () => {
      const obs: PerSliceObservation<AbdomenFindingSchema> = {
        sliceIndex: 0,
        totalSlices: 1,
        findings: {
          domain: "abdomen-pelvis",
          organFindings: [{ organ: "Liver", finding: "Hypodense lesion suspected." }],
          liverFindings: ["Lesion suspected."],
          kidneyFindings: [],
          bowelBladderFindings: ["Mild distension."],
          abnormalities: ["Large lesion suspicion."],
          impression: "Lesion.",
          recommendedNextSteps: ["Consider MRI."],
        },
        confidence: 72,
        limitations: [],
      };

      const agg = aggregateAbdomenSlices([obs]);

      expect(agg.studyLevelFindings.domain).toBe("abdomen-pelvis");
      expect(agg.studyLevelFindings.liverFindings).toContain("Lesion suspected.");
      expect(agg.studyLevelFindings.recommendedNextSteps).toContain(
        "Consider further characterization with MRI or biopsy as clinically indicated."
      );
      expect(agg.aggregatedConfidence).toBe(72);
    });

    it("returns empty structure for no observations", () => {
      const agg = aggregateAbdomenSlices([]);
      expect(agg.studyLevelFindings.domain).toBe("abdomen-pelvis");
      expect(agg.aggregatedConfidence).toBe(0);
    });
  });

  describe("analyzeAbdomenStudy", () => {
    it("returns empty result for no images", async () => {
      const result = await analyzeAbdomenStudy([], "en");
      expect(result.findings.impression).toContain("no images");
      expect(result.confidence).toBe(0);
      expect(mockRunDomainStructuredAnalysis).not.toHaveBeenCalled();
    });
  });
});
