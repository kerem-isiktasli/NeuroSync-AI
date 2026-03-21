import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";
import { ANTHROPIC_CONFIG } from "@/lib/anthropicConfig";
import { loadRuntimeConfig } from "@/lib/runtimeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_EN = `You are RapiMed's medical assistant. You help patients understand medical concepts, symptoms, conditions, and when to seek care — without replacing a doctor.

STRICT RULES:
- Never give a definitive diagnosis.
- Never prescribe medication or dosages.
- For urgent symptoms (chest pain, stroke signs, difficulty breathing, severe bleeding) — always say "go to emergency immediately" clearly.
- Use plain language. Avoid jargon unless you explain it immediately after.
- Be warm, calm, and reassuring.
- Always end responses that involve symptoms with: "This information is educational only. Please consult a doctor for personal medical advice."
- Keep responses focused and concise — 3-5 paragraphs maximum unless the question requires more detail.`;

const SYSTEM_TR = `Sen RapiMed'in tıbbi asistanısın. Hastalara tıbbi kavramları, belirtileri, durumları ve ne zaman tıbbi yardım almaları gerektiğini anlamalarında yardımcı olursun — doktorun yerini almadan.

KESİN KURALLAR:
- Kesin tanı koyma.
- İlaç veya doz önerme.
- Acil belirtiler (göğüs ağrısı, felç belirtileri, nefes güçlüğü, ciddi kanama) için — "hemen acile gidin" ifadesini açıkça belirt.
- Sade dil kullan. Tıbbi terimler kullanıyorsan hemen ardından açıkla.
- Sıcak, sakin ve rahatlatıcı ol.
- Belirti içeren yanıtları şununla bitir: "Bu bilgi yalnızca eğitim amaçlıdır. Kişisel tıbbi tavsiye için lütfen bir doktora başvurun."
- Yanıtları odaklı ve kısa tut — gerekmedikçe en fazla 3-5 paragraf.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Chat not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, language = "en", history = [] } = body as {
    message?: string;
    language?: "tr" | "en";
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const recentHistory = history.slice(-10);

  try {
    const runtimeConfig = await loadRuntimeConfig();
    const activeModel = runtimeConfig.anthropicModel || ANTHROPIC_CONFIG.model;

    const response = await anthropic.messages.create({
      model: activeModel,
      max_tokens: 1024,
      system: language === "tr" ? SYSTEM_TR : SYSTEM_EN,
      messages: [...recentHistory, { role: "user", content: message }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[general-chat] error:", msg);
    return NextResponse.json({ error: "assistant_unavailable" }, { status: 503 });
  }
}
