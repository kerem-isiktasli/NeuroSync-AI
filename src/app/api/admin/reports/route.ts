import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getAdminFirestore();
    const auth = getAdminAuth();
    const snap = await db.collection("reports").orderBy("createdAt", "desc").limit(100).get();

    const reports = await Promise.all(
      snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let userEmail = "";
        try {
          const user = await auth.getUser(data.userId as string);
          userEmail = user.email || "";
        } catch {
          /* user may be deleted */
        }
        const rawCreated = data.createdAt as { toDate?: () => Date } | string | undefined;
        const createdAt =
          rawCreated && typeof rawCreated === "object" && typeof rawCreated.toDate === "function"
            ? rawCreated.toDate().toISOString()
            : typeof rawCreated === "string"
              ? rawCreated
              : "";
        return {
          reportId: docSnap.id,
          userId: (data.userId as string) || "",
          userEmail,
          title: (data.title as string) || (data.fileName as string) || "Untitled",
          status: (data.status as string) || "unknown",
          concernLevel: (data.concernLevel as string) || "low",
          modality: (data.modality as string) || "",
          createdAt,
        };
      })
    );

    return NextResponse.json({ reports });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const reportId = url.searchParams.get("reportId");
  if (!reportId) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }
  await getAdminFirestore().collection("reports").doc(reportId).delete();
  return NextResponse.json({ success: true });
}
