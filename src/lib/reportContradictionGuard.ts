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
  /tek bir (aksiyel|aksiyel|koronal|sagittal) kesit/gi,
  /tek bir görüntü/gi,
  /tek bir kesit/gi,
  /tek kesit/gi,
  /Değerlendirme,\s*tek bir[^.]*üzerinden yapılmıştır/gi,
  /yalnızca tek (görüntü|kesit)/gi,
];
const SINGLE_IMAGE_PHRASES_EN = [
  /single axial (slice|image)/gi,
  /single coronal (slice|image)/gi,
  /single sagittal (slice|image)/gi,
  /single image/gi,
  /single slice/gi,
  /evaluation based on a single/gi,
  /only a single (slice|image)/gi,
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
const TRUNCATED_SENTENCE_PATTERNS = [
  /on this\s*\./gi,
  /from this\s*\./gi,
  /on a\s*\./gi,
  /from a\s*\./gi,
  /without a\s*\./gi,
  /based on a\s*[,.]?/gi,
  /of a\s*\./gi,
  /in this\s*\./gi,
  /this\s+[a-z]{0,20}\s*\./gi,
  /a single,?\s+[a-z]{0,20}\s*\./gi,
];

// Patterns for known scanner artifact hallucinations
const ARTIFACT_HALLUCINATION_PATTERNS = [
  /a (small|tiny),?\s+(bright|hyperintense)\s+signal\s+focus\s+(in|within)\s+the\s+subcutaneous[^.]*\.(possibly[^.]*\.)?/gi,
  /subcutaneous\s+soft\s+tissues[^.]*lipoma[^.]*/gi,
  /posterior\s+scalp[^.]*lipoma[^.]*/gi,
  /incidental\s+lipoma\s+or\s+cyst[^.]*/gi,
];

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
  // Remove known scanner artifact hallucinations
  for (const p of ARTIFACT_HALLUCINATION_PATTERNS) {
    out = out.replace(p, "").replace(/\s{2,}/g, " ").trim();
  }
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
