/**
 * Domain Analyzer Prompts — ensure prompts include schema and assessment criteria.
 */
import { describe, it, expect } from "vitest";
import { getDomainAnalyzerPrompt } from "../domainAnalyzerPrompts";

describe("getDomainAnalyzerPrompt", () => {
  it("brain prompt includes symmetry, ventricles, mass effect, hemorrhage, extra-axial", () => {
    const prompt = getDomainAnalyzerPrompt({
      domain: "brain",
      language: "en",
    });
    expect(prompt.toLowerCase()).toMatch(/symmetry|symmetr/);
    expect(prompt.toLowerCase()).toMatch(/ventricle/);
    expect(prompt.toLowerCase()).toMatch(/mass effect/);
    expect(prompt.toLowerCase()).toMatch(/hemorrhage|haemorrhage/);
    expect(prompt.toLowerCase()).toMatch(/extra-axial|extraaxial/);
    expect(prompt).toContain("lesionLocalization");
    expect(prompt).toContain("hemorrhageEdemaMassEffect");
    expect(prompt).toContain("ventricularFindings");
    expect(prompt).toContain("extraAxialFindings");
    expect(prompt).toContain("confidence");
    expect(prompt).toContain("limitations");
  });

  it("chest prompt includes lung, pleural effusion, mediastinum, nodule", () => {
    const prompt = getDomainAnalyzerPrompt({
      domain: "chest",
      language: "en",
    });
    expect(prompt.toLowerCase()).toMatch(/lung/);
    expect(prompt.toLowerCase()).toMatch(/pleural|effusion/);
    expect(prompt.toLowerCase()).toMatch(/mediastin/);
    expect(prompt.toLowerCase()).toMatch(/nodule|opacit|consolidat/);
    expect(prompt).toContain("lungLobeFindings");
    expect(prompt).toContain("pleuraEffusionConsolidation");
    expect(prompt).toContain("mediastinumFindings");
    expect(prompt).toContain("noduleFindings");
  });

  it("spine prompt includes alignment, disc, canal, vertebra level", () => {
    const prompt = getDomainAnalyzerPrompt({
      domain: "spine",
      language: "en",
      anatomicalRegion: "Lumbar",
    });
    expect(prompt.toLowerCase()).toMatch(/alignment|align/);
    expect(prompt.toLowerCase()).toMatch(/disc/);
    expect(prompt.toLowerCase()).toMatch(/canal/);
    expect(prompt.toLowerCase()).toMatch(/vertebra|level/);
    expect(prompt).toContain("vertebraeFindings");
    expect(prompt).toContain("canalForaminaFindings");
    expect(prompt).toContain("discFindings");
    expect(prompt).toContain("Lumbar");
  });

  it("abdomen prompt includes organ, asymmetry, fluid, distention", () => {
    const prompt = getDomainAnalyzerPrompt({
      domain: "abdomen-pelvis",
      language: "en",
    });
    expect(prompt.toLowerCase()).toMatch(/organ/);
    expect(prompt.toLowerCase()).toMatch(/asymmetry|lesion/);
    expect(prompt.toLowerCase()).toMatch(/fluid|distention|distension/);
    expect(prompt).toContain("organFindings");
    expect(prompt).toContain("liverFindings");
    expect(prompt).toContain("kidneyFindings");
  });

  it("includes slice context when provided", () => {
    const prompt = getDomainAnalyzerPrompt({
      domain: "brain",
      language: "en",
      sliceIndex: 2,
      totalSlices: 10,
    });
    expect(prompt).toContain("3/10");
  });

  it("general fallback for unsupported domain", () => {
    const prompt = getDomainAnalyzerPrompt({
      domain: "musculoskeletal",
      language: "en",
      anatomicalRegion: "Knee",
    });
    expect(prompt).toContain("findings");
    expect(prompt).toContain("abnormalities");
    expect(prompt).toContain("Knee");
  });

  it("Turkish language variant", () => {
    const prompt = getDomainAnalyzerPrompt({
      domain: "brain",
      language: "tr",
    });
    expect(prompt).toMatch(/nöroradyolog|radyolog/);
    expect(prompt).toMatch(/Simetri|simetri/);
    expect(prompt).toMatch(/Ventrikül|ventrikül/);
  });
});
