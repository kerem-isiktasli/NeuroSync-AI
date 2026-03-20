import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { invalidateConfigCache } from "@/lib/runtimeConfig";
import type { RuntimeConfig } from "@/lib/runtimeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyAdmin(request: Request): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const roleDoc = await getAdminFirestore().collection("roles").doc(uid).get();
    if (roleDoc.data()?.role !== "admin") return null;
    return { uid };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminDb = getAdminFirestore();
  const snap = await adminDb.collection("config").doc("active").get();
  if (!snap.exists) {
    const defaults = {
      vertexModel:
        process.env.VERTEX_EXTRACTION_MODEL ||
        process.env.VERTEX_MODEL ||
        "gemini-2.5-flash",
      vertexFallbackModel: process.env.VERTEX_FALLBACK_MODEL || "gemini-2.5-flash",
      anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      ocrEnabled: true,
      literatureEnabled: true,
      fusionEnabled: true,
      maxImages: 50,
      classificationConfidenceThreshold: 40,
      promptVersionKey: "v1",
      schemaVersion: "1.0",
    };
    return NextResponse.json({
      config: defaults,
      message: "Using defaults (no saved config yet)",
    });
  }
  const data = snap.data();
  return NextResponse.json({ config: data, updatedAt: data?.updatedAt });
}

const ALLOWED_KEYS: (keyof RuntimeConfig)[] = [
  "vertexModel",
  "vertexFallbackModel",
  "anthropicModel",
  "ocrEnabled",
  "literatureEnabled",
  "fusionEnabled",
  "maxImages",
  "maxImageBytes",
  "classificationConfidenceThreshold",
  "promptVersionKey",
  "schemaVersion",
];

export async function PATCH(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updates: Partial<RuntimeConfig> = {};
  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined) {
      const val = body[key];
      if (key === "ocrEnabled" || key === "literatureEnabled" || key === "fusionEnabled") {
        updates[key] = !!val;
      } else if (key === "maxImages" || key === "maxImageBytes" || key === "classificationConfidenceThreshold") {
        const n = Number(val);
        if (Number.isFinite(n)) updates[key as keyof RuntimeConfig] = n as never;
      } else if (key === "vertexModel" || key === "vertexFallbackModel" || key === "anthropicModel" || key === "promptVersionKey" || key === "schemaVersion") {
        if (typeof val === "string") updates[key as keyof RuntimeConfig] = val as never;
      }
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }
  const adminDb = getAdminFirestore();
  const now = new Date().toISOString();
  const docRef = adminDb.collection("config").doc("active");
  const snap = await docRef.get();
  const current = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const next = { ...current, ...updates, updatedAt: now, updatedBy: admin.uid };
  const historyRef = adminDb.collection("config_history").doc();
  await adminDb.runTransaction(async (tx) => {
    tx.set(historyRef, { ...current, archivedAt: now, archivedBy: admin.uid });
    tx.set(docRef, next);
  });
  invalidateConfigCache();
  return NextResponse.json({ success: true, config: next });
}
