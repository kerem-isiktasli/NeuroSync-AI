/**
 * Universal Synthesis Layer — Phase 5.
 * Synthesizes domain-specific structured outputs into a common report format.
 * Preserves domain-specific specificity.
 */
import type { DomainFinding, UniversalReportWrapper } from "./domainSchemas";

export interface SynthesizedReport {
  summary: string;
  detailedFindings: string[];
  limitations: string[];
  nextSteps: string[];
  confidence: number;
  additionalDataRequested: string[];
  domainSpecificContent: string;
}

export function synthesizeToCommonReport(
  wrapper: UniversalReportWrapper
): SynthesizedReport {
  const { domainFindings, confidence, limitations, additionalDataRequested } = wrapper;

  let summary = "";
  let detailedFindings: string[] = [];
  let nextSteps: string[] = [];
  let domainSpecificContent = "";

  switch (domainFindings.domain) {
    case "spine": {
      const s = domainFindings;
      summary = s.impression;
      detailedFindings = [
        ...s.vertebraeFindings.map((v) => `${v.level}: ${v.finding}`),
        ...s.canalForaminaFindings,
        ...s.discFindings,
        ...s.abnormalities,
      ].filter(Boolean);
      nextSteps = s.recommendedNextSteps;
      domainSpecificContent = s.vertebraeFindings
        .map((v) => `${v.level}: ${v.finding}`)
        .join("\n");
      break;
    }
    case "brain": {
      const b = domainFindings;
      summary = b.impression;
      detailedFindings = [
        ...b.lesionLocalization.map((l) => `${l.region}: ${l.finding}`),
        ...b.hemorrhageEdemaMassEffect,
        ...b.ventricularFindings,
        ...b.extraAxialFindings,
        ...b.abnormalities,
      ].filter(Boolean);
      nextSteps = b.recommendedNextSteps;
      domainSpecificContent = b.lesionLocalization
        .map((l) => `${l.region}: ${l.finding}`)
        .join("\n");
      break;
    }
    case "chest": {
      const c = domainFindings;
      summary = c.impression;
      detailedFindings = [
        ...c.lungLobeFindings.map((l) => `${l.lobe}: ${l.finding}`),
        ...c.pleuraEffusionConsolidation,
        ...c.noduleFindings,
        ...c.mediastinumFindings,
        ...c.abnormalities,
      ].filter(Boolean);
      nextSteps = c.recommendedNextSteps;
      domainSpecificContent = c.lungLobeFindings
        .map((l) => `${l.lobe}: ${l.finding}`)
        .join("\n");
      break;
    }
    case "abdomen-pelvis": {
      const a = domainFindings;
      summary = a.impression;
      detailedFindings = [
        ...a.organFindings.map((o) => `${o.organ}: ${o.finding}`),
        ...a.liverFindings,
        ...a.kidneyFindings,
        ...a.bowelBladderFindings,
        ...a.abnormalities,
      ].filter(Boolean);
      nextSteps = a.recommendedNextSteps;
      domainSpecificContent = a.organFindings
        .map((o) => `${o.organ}: ${o.finding}`)
        .join("\n");
      break;
    }
    case "document-only": {
      const d = domainFindings;
      summary = d.impression;
      detailedFindings = [...d.findings];
      nextSteps = d.recommendations;
      domainSpecificContent = d.clinicalHistory || d.findings.join("\n");
      break;
    }
    case "mixed-fusion": {
      const m = domainFindings;
      summary = m.finalImpression;
      detailedFindings = [...m.agreementPoints, ...m.contradictions.map((c) => `Image: ${c.imageFinding} vs Report: ${c.reportFinding}`)];
      nextSteps = m.recommendedNextSteps;
      domainSpecificContent = `Image summary: ${m.imageFindingsSummary}\nReport summary: ${m.documentFindingsSummary}`;
      break;
    }
    default: {
      const g = domainFindings as { findings: string[]; abnormalities: string[]; impression: string; recommendedNextSteps: string[] };
      summary = g.impression;
      detailedFindings = [...g.findings, ...g.abnormalities].filter(Boolean);
      nextSteps = g.recommendedNextSteps || [];
      domainSpecificContent = g.findings.join("\n");
    }
  }

  return {
    summary: summary || "No summary available.",
    detailedFindings: detailedFindings.length > 0 ? detailedFindings : ["No significant findings."],
    limitations: limitations.length > 0 ? limitations : ["AI interpretation has limitations. Expert review recommended."],
    nextSteps,
    confidence,
    additionalDataRequested: additionalDataRequested || [],
    domainSpecificContent,
  };
}
