import { NextResponse } from "next/server";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyAdmin(request: Request): Promise<{ uid: string } | null> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const roleDoc = await getAdminFirestore().collection("roles").doc(decoded.uid).get();
    if (roleDoc.data()?.role !== "admin") return null;
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// GET — list all user credit balances
export async function GET(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getAdminFirestore();
    const authAdmin = getAdminAuth();

    const listResult = await authAdmin.listUsers(100);

    const creditsSnap = await db.collection("credits").get();
    const creditMap = new Map<string, DocumentData>();
    creditsSnap.docs.forEach((doc) => {
      creditMap.set(doc.id, doc.data());
    });

    const credits = listResult.users.map((user) => {
      const data = creditMap.get(user.uid);
      const plan = data?.plan ?? "free";
      const reportTokens = typeof data?.reportTokens === "number" ? data.reportTokens : typeof data?.balance === "number" ? data.balance : 0;
      const agentTokens = typeof data?.agentTokens === "number" ? data.agentTokens : 0;
      const supportTokens = typeof data?.supportTokens === "number" ? data.supportTokens : 0;
      return {
        uid: user.uid,
        email: user.email || "",
        plan,
        reportTokens,
        agentTokens,
        supportTokens,
        reportTokensTotal: typeof data?.reportTokensTotal === "number" ? data.reportTokensTotal : 3,
        agentTokensTotal: typeof data?.agentTokensTotal === "number" ? data.agentTokensTotal : 10,
        supportTokensTotal: typeof data?.supportTokensTotal === "number" ? data.supportTokensTotal : 5,
        updatedAt: data?.updatedAt ?? "",
        hasDoc: !!data,
      };
    });

    credits.sort((a, b) => a.reportTokens + a.agentTokens + a.supportTokens - (b.reportTokens + b.agentTokens + b.supportTokens));

    return NextResponse.json({ credits });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — set token balances
export async function PATCH(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    uid?: string;
    reportTokens?: number;
    agentTokens?: number;
    supportTokens?: number;
    note?: string;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { uid, reportTokens, agentTokens, supportTokens, note } = payload;

  if (!uid) {
    return NextResponse.json({ error: "uid required" }, { status: 400 });
  }

  const hasTokenUpdate =
    typeof reportTokens === "number" ||
    typeof agentTokens === "number" ||
    typeof supportTokens === "number";

  if (!hasTokenUpdate) {
    return NextResponse.json({ error: "At least one of reportTokens, agentTokens, supportTokens required" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection("credits").doc(uid);

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    lastAdminAction: {
      by: admin.uid,
      at: new Date().toISOString(),
      note: note || "",
    },
  };

  if (typeof reportTokens === "number" && reportTokens >= 0) {
    updates.reportTokens = reportTokens;
    updates.reportTokensTotal = reportTokens;
  }
  if (typeof agentTokens === "number" && agentTokens >= 0) {
    updates.agentTokens = agentTokens;
    updates.agentTokensTotal = agentTokens;
  }
  if (typeof supportTokens === "number" && supportTokens >= 0) {
    updates.supportTokens = supportTokens;
    updates.supportTokensTotal = supportTokens;
  }

  await ref.set(updates, { merge: true });

  return NextResponse.json({
    success: true,
    uid,
    reportTokens,
    agentTokens,
    supportTokens,
  });
}
