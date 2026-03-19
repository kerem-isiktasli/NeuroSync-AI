import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  // Temporary diagnostics
  if (process.env.NODE_ENV !== "production") {
    console.log("[admin/verify] token exists:", !!token, "header present:", !!authHeader);
  }
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[admin/verify] no token, returning admin: false 401");
    }
    return NextResponse.json({ admin: false }, { status: 401 });
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const rolePath = `roles/${decoded.uid}`;
    const roleDoc = await getAdminFirestore().collection("roles").doc(decoded.uid).get();
    const role = roleDoc.data()?.role;
    const admin = role === "admin";
    if (process.env.NODE_ENV !== "production") {
      console.log("[admin/verify] decoded.uid:", decoded.uid, "rolePath:", rolePath, "role:", role, "admin:", admin);
    }
    return NextResponse.json({ admin }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isCredentialError =
      msg.includes("FIREBASE_APPLICATION_CREDENTIALS") ||
      msg.includes("credential") ||
      msg.includes("project_id") ||
      msg.includes("ENOENT") ||
      msg.includes("no such file");

    if (process.env.NODE_ENV !== "production") {
      console.error("[admin/verify] error:", msg);
      if (isCredentialError) {
        console.error(
          "[admin/verify] CREDENTIAL ERROR — check " +
            "FIREBASE_APPLICATION_CREDENTIALS in .env.local points " +
            "to a valid neurosync-e6846 service account JSON file"
        );
      }
    }
    return NextResponse.json(
      {
        admin: false,
        ...(process.env.NODE_ENV !== "production" && isCredentialError
          ? { debug: "credential_error" }
          : {}),
      },
      { status: 401 }
    );
  }
}
