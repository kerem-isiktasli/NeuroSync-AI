import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { verifyFirebaseIdToken } from "@/lib/verifyFirebaseIdToken";
import { parseNicknameInput, registryKeyFromDisplay } from "@/lib/nicknameUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NICKNAMES = "nicknames";

/**
 * GET ?n= — returns whether nickname registry key is available for the caller.
 */
export async function GET(request: Request) {
  const session = await verifyFirebaseIdToken(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("n") ?? "";
  if (!raw.trim()) {
    return NextResponse.json({ available: true, normalized: "" });
  }

  const parsed = parseNicknameInput(raw);
  if (!parsed.ok) {
    return NextResponse.json({
      available: false,
      reason: parsed.code,
      normalized: registryKeyFromDisplay(raw),
    });
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection(NICKNAMES).doc(parsed.key).get();
    if (!snap.exists) {
      return NextResponse.json({ available: true, normalized: parsed.key });
    }
    const owner = snap.data()?.uid as string | undefined;
    const available = owner === session.uid;
    return NextResponse.json({ available, normalized: parsed.key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("FIREBASE_APPLICATION_CREDENTIALS") ||
      msg.includes("credential") ||
      msg.includes("ENOENT")
    ) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 503 }
      );
    }
    console.error("[nickname-check]", msg);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
