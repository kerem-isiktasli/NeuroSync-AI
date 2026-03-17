/**
 * Domain analyzer dispatch tests — analyzeImageByDomain.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeImageByDomain } from "../index";

vi.mock("@/lib/googleHealthcare", () => ({
  googleHealthcare: {
    runDomainStructuredAnalysis: vi.fn(),
  },
}));

import { googleHealthcare } from "@/lib/googleHealthcare";

const mockRunDomainStructuredAnalysis = googleHealthcare.runDomainStructuredAnalysis as ReturnType<
  typeof vi.fn
>;

describe("analyzeImageByDomain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches brain domain to brain analyzer", async () => {
    mockRunDomainStructuredAnalysis.mockResolvedValue({
      lesionLocalization: [{ region: "General", finding: "Normal." }],
      hemorrhageEdemaMassEffect: [],
      ventricularFindings: ["Normal."],
      extraAxialFindings: [],
      abnormalities: [],
      impression: "Normal.",
      recommendedNextSteps: [],
      confidence: 90,
      limitations: [],
      evidenceSummary: "OK",
    });

    const result = await analyzeImageByDomain("brain", "base64...", { language: "en" });

    expect(result).not.toBeNull();
    expect(result!.findings.domain).toBe("brain");
    expect(result!.confidence).toBe(90);
  });

  it("dispatches chest domain to chest analyzer", async () => {
    mockRunDomainStructuredAnalysis.mockResolvedValue({
      lungLobeFindings: [{ lobe: "General", finding: "Clear." }],
      pleuraEffusionConsolidation: [],
      noduleFindings: [],
      mediastinumFindings: [],
      abnormalities: [],
      impression: "Clear.",
      recommendedNextSteps: [],
      confidence: 85,
      limitations: [],
      evidenceSummary: "OK",
    });

    const result = await analyzeImageByDomain("chest", "base64...");

    expect(result).not.toBeNull();
    expect(result!.findings.domain).toBe("chest");
  });

  it("dispatches spine domain to spine analyzer", async () => {
    mockRunDomainStructuredAnalysis.mockResolvedValue({
      vertebraeFindings: [{ level: "L4-L5", finding: "Normal." }],
      canalForaminaFindings: [],
      discFindings: [],
      abnormalities: [],
      impression: "Normal.",
      recommendedNextSteps: [],
      confidence: 80,
      limitations: [],
      evidenceSummary: "OK",
    });

    const result = await analyzeImageByDomain("spine", "base64...", {
      anatomicalRegion: "Lumbar",
    });

    expect(result).not.toBeNull();
    expect(result!.findings.domain).toBe("spine");
  });

  it("dispatches abdomen-pelvis domain to abdomen analyzer", async () => {
    mockRunDomainStructuredAnalysis.mockResolvedValue({
      organFindings: [{ organ: "Liver", finding: "Normal." }],
      liverFindings: [],
      kidneyFindings: [],
      bowelBladderFindings: [],
      abnormalities: [],
      impression: "Normal.",
      recommendedNextSteps: [],
      confidence: 75,
      limitations: [],
      evidenceSummary: "OK",
    });

    const result = await analyzeImageByDomain("abdomen-pelvis", "base64...");

    expect(result).not.toBeNull();
    expect(result!.findings.domain).toBe("abdomen-pelvis");
  });

  it("returns null for unsupported domains", async () => {
    const result = await analyzeImageByDomain("musculoskeletal", "base64...");
    expect(result).toBeNull();
  });

  it("returns null for document-only domain", async () => {
    const result = await analyzeImageByDomain("document-only", "base64...");
    expect(result).toBeNull();
  });
});
