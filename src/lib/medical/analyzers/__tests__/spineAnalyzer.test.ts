/**
 * Spine Analyzer Tests — structured output, confidence, limitations, aggregation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeSpine,
  analyzeSpineStudy,
  aggregateSpineSlices,
} from "../spineAnalyzer";
import type { PerSliceObservation } from "../types";
import type { SpineFindingSchema } from "../../domainSchemas";

vi.mock("@/lib/googleHealthcare", () => ({
  googleHealthcare: {
    runDomainStructuredAnalysis: vi.fn(),
  },
}));

import { googleHealthcare } from "@/lib/googleHealthcare";

const mockRunDomainStructuredAnalysis = googleHealthcare.runDomainStructuredAnalysis as ReturnType<
  typeof vi.fn
>;

const MOCK_SPINE_RESPONSE: Record<string, unknown> = {
  vertebraeFindings: [
    { level: "L4-L5", finding: "Disc bulge." },
    { level: "L5-S1", finding: "No significant finding." },
  ],
  canalForaminaFindings: ["Mild canal narrowing L4-L5."],
  discFindings: ["L4-L5 disc bulge."],
  abnormalities: ["Mild degenerative change."],
  impression: "Mild lumbar degenerative changes.",
  recommendedNextSteps: ["Routine follow-up per clinical indication."],
  confidence: 82,
  limitations: ["Sagittal only."],
  evidenceSummary: "Spine image analysis performed.",
};

describe("Spine Analyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeSpine", () => {
    it("returns SpineFindingSchema-compatible structure", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue(MOCK_SPINE_RESPONSE);

      const result = await analyzeSpine("base64...", "en", { anatomicalRegion: "Lumbar" });

      expect(result.findings.domain).toBe("spine");
      expect(result.findings.vertebraeFindings).toHaveLength(2);
      expect(result.findings.vertebraeFindings[0].level).toBe("L4-L5");
      expect(result.findings.canalForaminaFindings).toContain("Mild canal narrowing L4-L5.");
      expect(result.findings.discFindings).toContain("L4-L5 disc bulge.");
      expect(result.findings.impression).toBe("Mild lumbar degenerative changes.");
    });

    it("propagates confidence and limitations", async () => {
      mockRunDomainStructuredAnalysis.mockResolvedValue({
        ...MOCK_SPINE_RESPONSE,
        confidence: 65,
        limitations: ["Level uncertainty.", "Motion."],
      });

      const result = await analyzeSpine("base64...", "en");

      expect(result.confidence).toBe(65);
      expect(result.limitations).toContain("Level uncertainty.");
    });
  });

  describe("aggregateSpineSlices", () => {
    it("aggregates per-slice observations into study-level findings", () => {
      const obs1: PerSliceObservation<SpineFindingSchema> = {
        sliceIndex: 0,
        totalSlices: 2,
        findings: {
          domain: "spine",
          vertebraeFindings: [{ level: "L3-L4", finding: "Normal." }],
          canalForaminaFindings: [],
          discFindings: [],
          abnormalities: [],
          impression: "",
          recommendedNextSteps: [],
        },
        confidence: 85,
        limitations: [],
      };
      const obs2: PerSliceObservation<SpineFindingSchema> = {
        sliceIndex: 1,
        totalSlices: 2,
        findings: {
          domain: "spine",
          vertebraeFindings: [{ level: "L4-L5", finding: "Canal stenosis suspected." }],
          canalForaminaFindings: ["Moderate canal narrowing."],
          discFindings: ["Disc bulge."],
          abnormalities: ["Stenosis."],
          impression: "Stenosis.",
          recommendedNextSteps: ["Consider MRI."],
        },
        confidence: 75,
        limitations: ["Axial slice limited."],
      };

      const agg = aggregateSpineSlices([obs1, obs2]);

      expect(agg.studyLevelFindings.domain).toBe("spine");
      expect(agg.studyLevelFindings.vertebraeFindings.length).toBe(2);
      expect(agg.studyLevelFindings.canalForaminaFindings).toContain("Moderate canal narrowing.");
      expect(agg.studyLevelFindings.recommendedNextSteps).toContain(
        "Correlate with clinical symptoms. Consider MRI for cord signal evaluation."
      );
      expect(agg.aggregatedConfidence).toBe(80);
    });

    it("returns empty structure for no observations", () => {
      const agg = aggregateSpineSlices([]);
      expect(agg.studyLevelFindings.domain).toBe("spine");
      expect(agg.aggregatedConfidence).toBe(0);
    });
  });

  describe("analyzeSpineStudy", () => {
    it("returns empty result for no images", async () => {
      const result = await analyzeSpineStudy([], "en");
      expect(result.findings.impression).toContain("no images");
      expect(result.confidence).toBe(0);
      expect(mockRunDomainStructuredAnalysis).not.toHaveBeenCalled();
    });
  });
});
