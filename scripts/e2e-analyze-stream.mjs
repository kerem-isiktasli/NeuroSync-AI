/**
 * Consume full /api/analyze SSE stream and capture result/errors.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const MINI_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function run() {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "tr",
      images: [{ imageBase64: `data:image/png;base64,${MINI_PNG_B64}`, fileName: "test.png" }],
    }),
  });

  if (!res.ok) {
    console.log("HTTP", res.status, res.statusText);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  let result = null;
  let done = null;
  let error = null;

  while (true) {
    const { value, done: d } = await reader.read();
    if (d) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          events.push(data.type);
          if (data.type === "result") result = data.data;
          if (data.type === "done") done = data.data;
          if (data.type === "error") error = data.data;
        } catch (_) {}
      }
    }
  }

  console.log("Event sequence:", events.join(" -> "));
  if (error) console.log("ERROR:", JSON.stringify(error, null, 2));
  if (result) {
    console.log("Result keys:", Object.keys(result));
    console.log("Summary:", result?.summary?.slice(0, 80));
    console.log("Pipeline:", result?.meta?.pipeline);
    console.log("Intake:", result?.meta?.intakeSummary?.recommendedPipeline);
  }
  if (done) console.log("Done:", done);
}

run().catch((e) => console.error(e));
