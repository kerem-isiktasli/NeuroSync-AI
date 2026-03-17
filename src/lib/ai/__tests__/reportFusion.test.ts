/**
 * Unit tests for report fusion (OCR + image comparison).
 */

import { describe, it, expect } from "vitest";
import {
  buildReportFusionPrompt,
  parseFusionResponse,
  type ReportFusionInput,
} from "../reportFusion";

describe("buildReportFusionPrompt", () => {
  it("includes image findings and report text", () => {
    const input: ReportFusionInput = {
      language: "en",
      imageFindings: ["L4-L5 mild disc bulge", "No canal stenosis"],
      imageDiagnosis: "Mild lumbar degeneration",
      reportRawText: "MRI Lumbar Spine. Findings: L4-L5 disc bulge. No significant stenosis.",
      reportStructuredFindings: ["L4-L5 disc bulge", "No significant stenosis"],
    };
    const prompt = buildReportFusionPrompt(input);
    expect(prompt).toContain("L4-L5 mild disc bulge");
    expect(prompt).toContain("Mild lumbar degeneration");
    expect(prompt).toContain("MRI Lumbar Spine");
    expect(prompt).toContain("L4-L5 disc bulge");
  });
});

describe("parseFusionResponse", () => {
  it("parses valid JSON response", () => {
    const raw = `{
      "agreement_points": ["L4-L5 disc bulge noted in both"],
      "mismatch_points": [
        {"image_finding": "No canal stenosis", "report_finding": "Mild narrowing", "note": "Different wording"}
      ],
      "official_report_priority_note": "The official report takes precedence."
    }`;
    const result = parseFusionResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.agreement_points).toEqual(["L4-L5 disc bulge noted in both"]);
    expect(result!.mismatch_points).toHaveLength(1);
    expect(result!.mismatch_points[0].image_finding).toBe("No canal stenosis");
    expect(result!.mismatch_points[0].report_finding).toBe("Mild narrowing");
    expect(result!.official_report_priority_note).toBe("The official report takes precedence.");
  });

  it("handles JSON with code block wrapper", () => {
    const raw = "```json\n{\"agreement_points\":[\"A\"],\"mismatch_points\":[],\"official_report_priority_note\":\"\"}\n```";
    const result = parseFusionResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.agreement_points).toEqual(["A"]);
  });

  it("returns null for invalid input", () => {
    expect(parseFusionResponse("not json")).toBeNull();
    expect(parseFusionResponse("")).toBeNull();
  });
});
