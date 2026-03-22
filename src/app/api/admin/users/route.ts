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
    const auth = getAdminAuth();
    const db = getAdminFirestore();
    const listResult = await auth.listUsers(100);

    const users = await Promise.all(
      listResult.users.map(async (u) => {
        const reportsSnap = await db.collection("reports").where("userId", "==", u.uid).get();
        return {
          uid: u.uid,
          email: u.email || "",
          displayName: u.displayName || "",
          createdAt: u.metadata.creationTime || "",
          reportCount: reportsSnap.size,
          disabled: u.disabled,
        };
      })
    );

    return NextResponse.json({ users });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { uid, disabled } = await request.json();
  if (!uid || typeof disabled !== "boolean") {
    return NextResponse.json({ error: "uid and disabled required" }, { status: 400 });
  }
  await getAdminAuth().updateUser(uid, { disabled });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const uid = url.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  // Prevent deleting yourself
  if (uid === admin.uid) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const auth = getAdminAuth();

    // Delete Firebase Auth account
    await auth.deleteUser(uid);

    // Clean up Firestore data
    await Promise.allSettled([
      db.collection("credits").doc(uid).delete(),
      db.collection("roles").doc(uid).delete(),
      db.collection("supportRoles").doc(uid).delete(),
      db.collection("users").doc(uid).delete(),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
