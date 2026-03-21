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

export async function GET(request: Request) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const supportUser = await isSupport(decoded.uid);

  const snap = supportUser
    ? await db.collection("supportTickets").orderBy("updatedAt", "desc").limit(200).get()
    : await db.collection("supportTickets").where("patientUid", "==", decoded.uid).orderBy("updatedAt", "desc").get();

  return NextResponse.json({
    tickets: snap.docs.map((d) => ({
      ticketId: d.id,
      ...d.data(),
    })),
    isSupportStaff: supportUser,
  });
}

export async function POST(request: Request) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    category: string;
    subject: string;
    message: string;
    dataConsent: boolean;
    attachments?: Array<{ url: string; name: string; type: string }>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.category || !body.subject || !body.message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const auth = getAdminAuth();
  let patientEmail = "";
  try {
    const u = await auth.getUser(decoded.uid);
    patientEmail = u.email || "";
  } catch {
    /* ignore */
  }

  const now = new Date().toISOString();
  const ref = db.collection("supportTickets").doc();

  await ref.set({
    ticketId: ref.id,
    patientUid: decoded.uid,
    patientEmail,
    category: body.category,
    subject: body.subject,
    message: body.message,
    dataConsent: body.dataConsent === true,
    status: "open",
    assignedTo: null,
    assignedEmail: null,
    patientUnread: 0,
    supportUnread: 1,
    createdAt: now,
    updatedAt: now,
  });

  await ref.collection("messages").add({
    senderUid: decoded.uid,
    senderRole: "patient",
    senderEmail: patientEmail,
    text: body.message,
    attachments: body.attachments ?? [],
    createdAt: now,
    read: false,
  });

  return NextResponse.json({
    success: true,
    ticketId: ref.id,
  });
}
