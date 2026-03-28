/**
 * Deterministic contradiction guards.
 * Strips or replaces report text that contradicts known metadata.
 * Applied before final report reaches the patient.
 */

export interface GuardContext {
  imageCount: number;
  planesAvailable: string[];
  displayUnit: "images" | "slices";
  contrastEnhancementPresent?: boolean;
  obviousAbnormalityPresent?: boolean;
  aggregatedFindingsCount?: number;
}

const SINGLE_IMAGE_PHRASES_TR = [
  /tek bir (aksiyel|koronal|sagittal|lateral|ap) (kesit|görüntü|grafi|radyografi|görünüm)/gi,
  /tek bir (görüntü|kesit|grafi|radyografi|görünüm)/gi,
  /tek (kesit|görüntü|grafi|radyografi|görünüm)/gi,
  /Değerlendirme,\s*tek bir[^.]*üzerinden yapılmıştır/gi,
  /yalnızca tek (görüntü|kesit|grafi)/gi,
  /lateral (görünüm|grafi) (mevcut|bulunmamaktadır|yoktur)/gi,
  /ap (görünüm|grafi) (mevcut|bulunmamaktadır|yoktur)/gi,
];

const SINGLE_IMAGE_PHRASES_EN = [
  /single (axial|coronal|sagittal|lateral|ap|anteroposterior|pa) (slice|image|radiograph|view)/gi,
  /single (image|slice|radiograph|view)/gi,
  /evaluation (is )?based on a single[^.]*/gi,
  /interpretation (is )?based on a single[^.]*/gi,
  /only a single (slice|image|radiograph|view)/gi,
  /a (lateral|ap|anteroposterior) view is not available[^.]*/gi,
  /complete radiographic series[^.]*is not available/gi,
];
const NO_CONTRAST_PHRASES_TR = [
  /kontrast öncesi görüntüler ve diğer mr sekansları olmadan/gi,
  /kontrast sonrası görüntüler olmadan/gi,
];
const NO_CONTRAST_PHRASES_EN = [
  /without post-contrast images/gi,
  /no post-contrast images/gi,
];

function stripContradictoryPhrase(text: string, patterns: RegExp[]): string {
  let out = text;
  for (const p of patterns) {
    out = out.replace(p, "").replace(/\s{2,}/g, " ").trim();
  }
  return out;
}

// Patterns for truncated sentences caused by failed variable substitution in the AI output
// (Uses \b word boundary — not a literal backspace character.)
const TRUNCATED_SENTENCE_PATTERNS = [
  /\bon this\s*\./gi,
  /\bfrom this\s*\./gi,
  /\bon a\s*\./gi,
  /\bfrom a\s*\./gi,
  /\bwithout a\s*\./gi,
  /\bof a\s*\./gi,
  /\bin this\s*\./gi,
  /\bthis\s+[a-z]{0,20}\s*\./gi,
  /\ba single,?\s+[a-z]{0,20}\s*\./gi,
];

/** Multi-token broken templates e.g. "based on a . A ." from null interpolation */
const BROKEN_TEMPLATE_PATTERNS = [
  /This interpretation is based on a\s*\.\s*A\s*\./gi,
  /This evaluation is based on a\s*\.\s*A\s*\./gi,
  /interpretation is based on a\s*\.\s*A\s*\./gi,
  /evaluation is based on a\s*\.\s*A\s*\./gi,
  /based on a\s*\.\s*A\s*\./gi,
  /based on an?\s+\.\s*/gi,
  /\bA\s*\.\s*A\s*\./gi,
  /\bbased\s+A\s*\./gi,
  /\bbased\s+on\s+A\s*\./gi,
  /\bThis interpretation is based\s+A\s*\./gi,
];

// Patterns for known scanner artifact hallucinations
const ARTIFACT_HALLUCINATION_PATTERNS = [
  /a (small|tiny),?\s+(bright|hyperintense)\s+signal\s+focus\s+(in|within)\s+the\s+subcutaneous[^.]*\.(possibly[^.]*\.)?/gi,
  /subcutaneous\s+soft\s+tissues[^.]*lipoma[^.]*/gi,
  /posterior\s+scalp[^.]*lipoma[^.]*/gi,
  /incidental\s+lipoma\s+or\s+cyst[^.]*/gi,
];

/** Fix incomplete model phrases: "This interpretation is single…" / bare "This interpretation is." */
function repairInterpretationScopeEnglish(out: string): string {
  return out
    .replace(/\bThis interpretation is\s+single\b/gi, "This interpretation is based on a single")
    .replace(/\bThis interpretation is\s+lateral\b/gi, "This interpretation is based on a lateral")
    .replace(/\bThis interpretation is\s+an\s+(?!based\b)/gi, "This interpretation is based on an ")
    .replace(/\bThis interpretation is\s+a\s+(?!based\b)(?=single|double|frontal|posterior|chest|thoracic|normal|abnormal|lateral|pa\b|ap\b)/gi, "This interpretation is based on a ")
    .replace(/\bThis interpretation is\s*\.\s*/gi, "This interpretation is based on the provided imaging study. ")
    .replace(/\bThis interpretation is\s*$/gim, "This interpretation is based on the provided imaging study.");
}

function applyGuardsToText(text: string | undefined, ctx: GuardContext): string {
  if (!text || typeof text !== "string") return text ?? "";
  let out = text;
  if (ctx.imageCount > 1) {
    out = stripContradictoryPhrase(out, [...SINGLE_IMAGE_PHRASES_TR, ...SINGLE_IMAGE_PHRASES_EN]);
  }
  if (ctx.planesAvailable.length > 1) {
    out = stripContradictoryPhrase(out, SINGLE_IMAGE_PHRASES_TR);
    out = stripContradictoryPhrase(out, SINGLE_IMAGE_PHRASES_EN);
  }
  if (ctx.contrastEnhancementPresent === true) {
    out = stripContradictoryPhrase(out, [...NO_CONTRAST_PHRASES_TR, ...NO_CONTRAST_PHRASES_EN]);
  }
  // Remove truncated sentences from failed variable substitution
  for (const p of TRUNCATED_SENTENCE_PATTERNS) {
    out = out.replace(p, "").replace(/\s{2,}/g, " ").trim();
  }
  for (const p of BROKEN_TEMPLATE_PATTERNS) {
    out = out.replace(p, "").replace(/\s{2,}/g, " ").trim();
  }
  // Remove known scanner artifact hallucinations
  for (const p of ARTIFACT_HALLUCINATION_PATTERNS) {
    out = out.replace(p, "").replace(/\s{2,}/g, " ").trim();
  }
  out = repairInterpretationScopeEnglish(out);
  return out;
}

export interface ReportSectionsForGuard {
  exam_overview?: string;
  technical_summary?: string;
  detailed_findings?: string[];
  interpretive_impression?: string;
  limitations?: string[];
  study_adequacy_summary?: string;
  what_cannot_be_determined?: string[];
}

export interface ReportForGuard {
  summary?: string;
  report_sections?: ReportSectionsForGuard;
  professional_report_markdown?: string;
}

/**
 * Apply contradiction guards to report text fields.
 * Mutates the report in place.
 */
export function applyContradictionGuards(
  report: ReportForGuard,
  ctx: GuardContext
): void {
  if (!report) return;
  if (report.summary) {
    report.summary = applyGuardsToText(report.summary, ctx);
  }
  if (report.report_sections) {
    const rs = report.report_sections;
    if (rs.exam_overview) rs.exam_overview = applyGuardsToText(rs.exam_overview, ctx);
    if (rs.technical_summary) rs.technical_summary = applyGuardsToText(rs.technical_summary, ctx);
    if (rs.interpretive_impression) rs.interpretive_impression = applyGuardsToText(rs.interpretive_impression, ctx);
    if (rs.study_adequacy_summary) rs.study_adequacy_summary = applyGuardsToText(rs.study_adequacy_summary, ctx);
    if (Array.isArray(rs.detailed_findings)) {
      rs.detailed_findings = rs.detailed_findings
        .map((f) => applyGuardsToText(f, ctx))
        .filter((f) => f.trim().length > 20);
    }
    if (Array.isArray(rs.limitations)) {
      rs.limitations = rs.limitations.map((l) => applyGuardsToText(l, ctx));
      // Deduplicate limitations and cap at 6
      const seenLim = new Set<string>();
      rs.limitations = rs.limitations
        .filter(item => {
          const key = item.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
          if (seenLim.has(key)) return false;
          seenLim.add(key);
          return true;
        })
        .filter(item => item.trim().length > 20)
        .slice(0, 6);
    }
    if (Array.isArray(rs.what_cannot_be_determined)) {
      rs.what_cannot_be_determined = rs.what_cannot_be_determined.map((w) => applyGuardsToText(w, ctx));
    }
  }
  if (report.professional_report_markdown) {
    report.professional_report_markdown = applyGuardsToText(report.professional_report_markdown, ctx);
  }
}
