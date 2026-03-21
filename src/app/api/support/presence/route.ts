import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyAuth(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

async function isSupport(uid: string) {
  const db = getAdminFirestore();
  const [s, a] = await Promise.all([
    db.collection("supportRoles").doc(uid).get(),
    db.collection("roles").doc(uid).get(),
  ]);
  return s.data()?.role === "support" || a.data()?.role === "admin";
}

/** Employee heartbeat (call every ~30s). Restricted to support/admin. */
export async function POST(request: Request) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isSupport(decoded.uid))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    typing?: boolean;
    activeTicketId?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const db = getAdminFirestore();
  const auth = getAdminAuth();
  let email = "";
  try {
    const u = await auth.getUser(decoded.uid);
    email = u.email || "";
  } catch {
    /* ignore */
  }

  await db
    .collection("supportPresence")
    .doc(decoded.uid)
    .set(
      {
        uid: decoded.uid,
        email,
        lastSeen: new Date().toISOString(),
        online: true,
        typing: body.typing ?? false,
        activeTicketId: body.activeTicketId ?? null,
      },
      { merge: true }
    );

  return NextResponse.json({ success: true });
}

/** List support employee presence (admin only). */
export async function GET(request: Request) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const adminDoc = await db.collection("roles").doc(decoded.uid).get();
  if (adminDoc.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snap = await db.collection("supportPresence").get();
  const now = Date.now();
  const presence = snap.docs.map((d) => {
    const data = d.data();
    const lastSeen = new Date(String(data.lastSeen ?? 0)).getTime();
    return {
      ...data,
      online: now - lastSeen < 60_000,
    };
  });
  return NextResponse.json({ presence });
}
