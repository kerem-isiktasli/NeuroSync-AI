import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";
import { getReportChatSystemPrompt } from "@/lib/ai/reportChatPrompts";
import { ANTHROPIC_CONFIG } from "@/lib/anthropicConfig";
import { loadRuntimeConfig } from "@/lib/runtimeConfig";
import { getReportModeLabel } from "@/lib/reportTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ReportContextPacket {
  /** When LOCALIZER_DETECTED: no pathology interpretation; focus on what to upload next. */
  reportType?: "DIAGNOSTIC" | "LOCALIZER_DETECTED";
  /** Standardized report mode (full interpretation, metadata-only, etc.). */
  reportMode?: string;
  reportLabel?: {
    whatWasActuallyAnalyzed?: string[];
    whatCouldNotBeDetermined?: string[];
    analyzedFileCount?: number;
    adequacyTier?: string;
  };
  localizerReport?: {
    interpretation: string;
    explanation: string;
    recommendation: string[];
    detectedIndicators: string[];
    confidence: number;
  };
  fileName: string;
  modality: string;
  anatomicalRegion: string;
  concernLevel: string;
  summary: string;
  keyFindings: string[];
  detailedFindings: string[];
  interpretiveImpression: string;
  limitations: string[];
  additionalDataRequested: Array<{ item: string; reason: string; priority: string }>;
  questionsForDoctor: string[];
  followUpConsiderations: string[];
  medicalDisclaimer: string;
  userQuestion: string;
  /** Official report text (from OCR) when available */
  officialReportText?: string;
  /** Fusion: agreement/mismatch between AI and official report */
  reportFusion?: {
    official_report_present: boolean;
    report_text_summary: string;
    agreement_points: string[];
    mismatch_points: Array<{ image_finding: string; report_finding: string; note: string }>;
    official_report_priority_note: string;
  };
  /** Extended context for specific answers */
  examOverview?: string;
  technicalSummary?: string;
  studyAdequacySummary?: string;
  anatomicalSpecificitySummary?: string;
  findingsByLevelSummary?: string;
  whatCannotBeDetermined?: string[];
  evidenceAgreementSummary?: string;
  differentialConsiderations?: Array<{ label: string; likelihood: string; why_it_matches: string; why_not_certain: string }>;
  redFlags?: string[];
  importantTerms?: Array<{ term: string; plain_explanation: string }>;
  nextSteps?: string[];
  confidenceLevel?: string;
  confidenceReasons?: string[];
}

function buildUserMessage(ctx: ReportContextPacket): string {
  const parts: string[] = [];

  if (ctx.reportType === "LOCALIZER_DETECTED" && ctx.localizerReport) {
    parts.push(
      "## IMPORTANT: LOCALIZER-ONLY REPORT",
      "",
      "This report is NOT a diagnostic interpretation. The uploaded images were detected as MRI/CT localizer (scout) positioning scans.",
      "No pathology interpretation was performed. The assistant must focus on explaining what was detected and what the user should upload instead.",
      "",
      "### Localizer detection",
      `**What was detected:** ${ctx.localizerReport.interpretation}`,
      `**Why not diagnostic:** ${ctx.localizerReport.explanation}`,
      `**Confidence:** ${Math.round((ctx.localizerReport.confidence ?? 0) * 100)}%`,
      "",
      "### Detected indicators",
      ...(ctx.localizerReport.detectedIndicators?.map((i) => `- ${i}`) ?? []),
      "",
      "### Recommended uploads (exact next steps)",
      ...(ctx.localizerReport.recommendation?.map((r) => `- ${r}`) ?? []),
      "",
      "---",
      "",
    );
  }

  const reportTypeLine = ctx.reportMode
    ? `**Report type:** ${getReportModeLabel(ctx.reportMode, "en")}`
    : ctx.reportType === "LOCALIZER_DETECTED"
      ? "**Report type:** Localizer / Positioning scan (NOT diagnostic)"
      : null;

  parts.push(
    "## Report context",
    "",
    `**File:** ${ctx.fileName}`,
    `**Modality:** ${ctx.modality || "—"}`,
    `**Anatomical region:** ${ctx.anatomicalRegion || "—"}`,
    `**Concern level:** ${ctx.concernLevel || "moderate"}`,
    ...(reportTypeLine ? [reportTypeLine, ""] : []),
    "",
    "### Summary",
    ctx.summary || "(none)",
    "",
  );

  if (ctx.examOverview) {
    parts.push("### Exam overview", "", ctx.examOverview, "");
  }
  if (ctx.technicalSummary) {
    parts.push("### Technical summary", "", ctx.technicalSummary, "");
  }
  if (ctx.studyAdequacySummary) {
    parts.push("### Study adequacy", "", ctx.studyAdequacySummary, "");
  }
  if (ctx.keyFindings?.length) {
    parts.push("### Key findings", "", ...ctx.keyFindings.map((f) => `- ${f}`), "");
  }
  if (ctx.detailedFindings?.length) {
    parts.push("### Detailed findings", "", ...ctx.detailedFindings.map((f) => `- ${f}`), "");
  }
  if (ctx.anatomicalSpecificitySummary) {
    parts.push("### Anatomical specificity (levels/sides)", "", ctx.anatomicalSpecificitySummary, "");
  }
  if (ctx.findingsByLevelSummary) {
    parts.push("### Findings by level", "", ctx.findingsByLevelSummary, "");
  }
  if (ctx.interpretiveImpression) {
    parts.push("### Interpretive impression", "", ctx.interpretiveImpression, "");
  }
  if (ctx.differentialConsiderations?.length) {
    parts.push("### Differential considerations (possible explanations)", "");
    ctx.differentialConsiderations.forEach((d) => {
      parts.push(`- **${d.label}** [${d.likelihood}]: ${d.why_it_matches} | Why not certain: ${d.why_not_certain}`);
    });
    parts.push("");
  }
  if (ctx.redFlags?.length) {
    parts.push("### Red flags (may require urgent review)", "", ...ctx.redFlags.map((r) => `- ${r}`), "");
  }
  if (ctx.whatCannotBeDetermined?.length) {
    parts.push("### What cannot be determined from available evidence", "", ...ctx.whatCannotBeDetermined.map((w) => `- ${w}`), "");
  }
  if (ctx.evidenceAgreementSummary) {
    parts.push("### Evidence agreement (multi-image / cross-source)", "", ctx.evidenceAgreementSummary, "");
  }
  if (ctx.limitations?.length) {
    parts.push("### Limitations", "", ...ctx.limitations.map((l) => `- ${l}`), "");
  }
  if (ctx.confidenceLevel || ctx.confidenceReasons?.length) {
    parts.push("### Confidence assessment", "");
    if (ctx.confidenceLevel) parts.push(`Level: ${ctx.confidenceLevel}`, "");
    if (ctx.confidenceReasons?.length) {
      parts.push("Reasons:", "", ...ctx.confidenceReasons.map((r) => `- ${r}`), "");
    }
  }
  if (ctx.additionalDataRequested?.length) {
    parts.push("### Additional data requested", "");
    ctx.additionalDataRequested.forEach((a) => {
      parts.push(`- ${a.item} (${a.priority}): ${a.reason}`);
    });
    parts.push("");
  }
  if (ctx.importantTerms?.length) {
    parts.push("### Important terms explained", "");
    ctx.importantTerms.forEach((t) => parts.push(`- **${t.term}**: ${t.plain_explanation}`));
    parts.push("");
  }
  if (ctx.nextSteps?.length) {
    parts.push("### Next steps", "", ...ctx.nextSteps.map((n) => `- ${n}`), "");
  }
  if (ctx.questionsForDoctor?.length) {
    parts.push("### Questions for doctor", "", ...ctx.questionsForDoctor.map((q) => `- ${q}`), "");
  }
  if (ctx.followUpConsiderations?.length) {
    parts.push("### Follow-up considerations", "", ...ctx.followUpConsiderations.map((f) => `- ${f}`), "");
  }
  if (ctx.medicalDisclaimer) {
    parts.push("### Medical disclaimer", "", ctx.medicalDisclaimer, "");
  }
  if (ctx.officialReportText) {
    parts.push("### Official report text (from patient's document)", "", ctx.officialReportText.slice(0, 2000), "");
  }
  if (ctx.reportFusion?.official_report_present) {
    parts.push("### AI vs official report comparison", "");
    if (ctx.reportFusion.agreement_points?.length) {
      parts.push("**Agreements:**", "", ...ctx.reportFusion.agreement_points.map((a) => `- ${a}`), "");
    }
    if (ctx.reportFusion.mismatch_points?.length) {
      parts.push("**Disagreements:**", "");
      ctx.reportFusion.mismatch_points.forEach((m) => {
        parts.push(`- AI: ${m.image_finding} | Report: ${m.report_finding} | Note: ${m.note}`);
      });
      parts.push("");
    }
    if (ctx.reportFusion.official_report_priority_note) {
      parts.push("**Priority note:**", ctx.reportFusion.official_report_priority_note, "");
    }
  }

  parts.push("---", "", "## User question", "", ctx.userQuestion);
  return parts.join("\n");
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Report chat not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : "Invalid JSON body";
    console.error("[report-chat] Request body parse failed:", msg);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { context, language = "en", patientContext } = (body || {}) as {
    context?: ReportContextPacket;
    language?: "tr" | "en";
    patientContext?: {
      knownDiagnoses?: string[];
      chronicConditions?: string[];
      priorSurgeries?: string[];
      activeFollowUpDiagnoses?: string[];
      primaryConcern?: string;
      bodyRegion?: string;
      fileType?: string;
      symptomDuration?: string;
      symptomTrend?: string;
      studyTimeline?: string;
      uploadFormat?: string;
      desiredOutput?: string[];
    };
  };

  if (!context?.userQuestion?.trim()) {
    return NextResponse.json({ error: "userQuestion is required" }, { status: 400 });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[report-chat] request:", {
      userQuestion: context.userQuestion.slice(0, 80),
      contextKeys: Object.keys(context),
      language,
    });
  }

  const runtimeConfig = await loadRuntimeConfig();
  const activeModel =
    runtimeConfig.anthropicModel || ANTHROPIC_CONFIG.model;

  try {
    const systemPrompt = getReportChatSystemPrompt(language === "tr" ? "tr" : "en");
    let userMessage = buildUserMessage(context);

    if (patientContext) {
      const pcParts: string[] = ["", "---", "", "## Patient Context (from saved profile and intake)"];
      if (patientContext.knownDiagnoses?.length) pcParts.push(`Known diagnoses: ${patientContext.knownDiagnoses.join(", ")}`);
      if (patientContext.chronicConditions?.length) pcParts.push(`Chronic conditions: ${patientContext.chronicConditions.join(", ")}`);
      if (patientContext.priorSurgeries?.length) pcParts.push(`Prior surgeries: ${patientContext.priorSurgeries.join(", ")}`);
      if (patientContext.activeFollowUpDiagnoses?.length) pcParts.push(`Active follow-up: ${patientContext.activeFollowUpDiagnoses.join(", ")}`);
      if (patientContext.primaryConcern) pcParts.push(`Primary concern for this upload: ${patientContext.primaryConcern}`);
      if (patientContext.bodyRegion) pcParts.push(`Body region: ${patientContext.bodyRegion}`);
      if (patientContext.symptomDuration) pcParts.push(`Symptom duration: ${patientContext.symptomDuration}`);
      if (patientContext.symptomTrend) pcParts.push(`Symptom trend: ${patientContext.symptomTrend}`);
      if (patientContext.studyTimeline) pcParts.push(`Study timeline: ${patientContext.studyTimeline}`);
      if (patientContext.desiredOutput?.length) pcParts.push(`Desired output: ${patientContext.desiredOutput.join(", ")}`);
      pcParts.push("", "Use this patient context to provide more relevant, personalized answers. If the patient has known conditions, interpret findings in that context.");
      userMessage += pcParts.join("\n");
    }

    const callLLM = () =>
      anthropic.messages.create({
        model: activeModel,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

    let response;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await callLLM();
        break;
      } catch (err) {
        lastErr = err;
        const errStr = String(err instanceof Error ? err.message : err);
        const isRateLimit =
          (err && typeof err === "object" && "status" in err && (err as { status?: number }).status === 429) ||
          errStr.includes("429") ||
          errStr.toLowerCase().includes("rate_limit");
        if (isRateLimit && attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[report-chat] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/3)`);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }

    if (!response) {
      throw lastErr ?? new Error("LLM call failed");
    }

    const text =
      response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim() || "";

    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[report-chat] LLM error:", msg);
    console.error("[report-chat] stack:", stack);
    if (process.env.NODE_ENV !== "production") {
      console.error("[report-chat] provider status:", err && typeof err === "object" && "status" in err ? (err as { status?: number }).status : "N/A");
      console.error("[report-chat] model used:", activeModel);
    }
    return NextResponse.json(
      { error: "assistant_unavailable", message: "The report assistant is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}
