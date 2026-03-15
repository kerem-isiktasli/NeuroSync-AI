import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";
import { getReportChatSystemPrompt } from "@/lib/ai/reportChatPrompts";
import { ANTHROPIC_CONFIG } from "@/lib/anthropicConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ReportContextPacket {
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
}

function buildUserMessage(ctx: ReportContextPacket): string {
  const parts: string[] = [
    "## Report context",
    "",
    `**File:** ${ctx.fileName}`,
    `**Modality:** ${ctx.modality || "—"}`,
    `**Anatomical region:** ${ctx.anatomicalRegion || "—"}`,
    `**Concern level:** ${ctx.concernLevel || "moderate"}`,
    "",
    "### Summary",
    ctx.summary || "(none)",
    "",
  ];

  if (ctx.keyFindings?.length) {
    parts.push("### Key findings", "", ...ctx.keyFindings.map((f) => `- ${f}`), "");
  }
  if (ctx.detailedFindings?.length) {
    parts.push("### Detailed findings", "", ...ctx.detailedFindings.map((f) => `- ${f}`), "");
  }
  if (ctx.interpretiveImpression) {
    parts.push("### Interpretive impression", "", ctx.interpretiveImpression, "");
  }
  if (ctx.limitations?.length) {
    parts.push("### Limitations", "", ...ctx.limitations.map((l) => `- ${l}`), "");
  }
  if (ctx.additionalDataRequested?.length) {
    parts.push("### Additional data requested", "");
    ctx.additionalDataRequested.forEach((a) => {
      parts.push(`- ${a.item} (${a.priority}): ${a.reason}`);
    });
    parts.push("");
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

  const { context, language = "en" } = (body || {}) as {
    context?: ReportContextPacket;
    language?: "tr" | "en";
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

  try {
    const systemPrompt = getReportChatSystemPrompt(language === "tr" ? "tr" : "en");
    const userMessage = buildUserMessage(context);

    const callLLM = () =>
      anthropic.messages.create({
        model: ANTHROPIC_CONFIG.model,
        max_tokens: 1024,
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
      console.error("[report-chat] model used:", ANTHROPIC_CONFIG.model);
    }
    return NextResponse.json(
      { error: "assistant_unavailable", message: "The report assistant is temporarily unavailable. Please try again." },
      { status: 503 }
    );
  }
}
