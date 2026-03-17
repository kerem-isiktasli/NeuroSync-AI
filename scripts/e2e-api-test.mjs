/**
 * E2E API validation script.
 * Tests /api/analyze and /api/report-chat reachability and basic behavior.
 * Run with: node scripts/e2e-api-test.mjs
 * Ensure dev server is running: npm run dev
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

// Minimal valid 1x1 red PNG (base64)
const MINI_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function testAnalyzeReachability() {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "tr",
      images: [{ imageBase64: `data:image/png;base64,${MINI_PNG_B64}`, fileName: "test.png" }],
    }),
  });
  const ok = res.ok || res.status === 200;
  const contentType = res.headers.get("content-type") || "";
  const isStream = contentType.includes("text/event-stream");
  let firstChunk = "";
  if (res.body) {
    const reader = res.body.getReader();
    const { value } = await reader.read();
    firstChunk = value ? new TextDecoder().decode(value).slice(0, 200) : "";
  }
  return {
    status: res.status,
    ok,
    isStream,
    firstChunk,
    contentType: contentType.slice(0, 50),
  };
}

async function testReportChat() {
  const res = await fetch(`${BASE}/api/report-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "tr",
      context: {
        fileName: "test.jpg",
        modality: "MRI",
        anatomicalRegion: "Lumbar",
        concernLevel: "moderate",
        summary: "Mild disc bulge at L4-L5.",
        keyFindings: ["L4-L5 disc bulge"],
        detailedFindings: ["L4-L5: Mild posterior disc bulge."],
        interpretiveImpression: "Mild degenerative changes.",
        limitations: [],
        additionalDataRequested: [],
        questionsForDoctor: [],
        followUpConsiderations: [],
        medicalDisclaimer: "Informational only.",
        userQuestion: "what do I have?",
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  return {
    status: res.status,
    ok: res.ok,
    hasText: !!body?.text,
    error: body?.error,
    textPreview: body?.text?.slice(0, 100),
  };
}

async function main() {
  console.log("E2E API Test — BASE:", BASE);
  console.log("");

  try {
    console.log("1. /api/analyze (POST with 1x1 PNG)...");
    const a = await testAnalyzeReachability();
    console.log("   Status:", a.status, "OK:", a.ok, "Stream:", a.isStream);
    console.log("   Content-Type:", a.contentType);
    if (a.firstChunk) console.log("   First chunk:", a.firstChunk.slice(0, 120));
    console.log("");

    console.log("2. /api/report-chat (POST with context)...");
    const c = await testReportChat();
    console.log("   Status:", c.status, "OK:", c.ok);
    console.log("   Has text:", c.hasText);
    if (c.error) console.log("   Error:", c.error);
    if (c.textPreview) console.log("   Text preview:", c.textPreview);
    console.log("");
  } catch (err) {
    console.error("Request failed:", err.message);
  }
}

main();
