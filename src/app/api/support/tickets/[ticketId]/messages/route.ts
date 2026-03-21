import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

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

export async function GET(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await params;

  const db = getAdminFirestore();
  const ticket = await db.collection("supportTickets").doc(ticketId).get();
  if (!ticket.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supportUser = await isSupport(decoded.uid);
  const isPatient = ticket.data()?.patientUid === decoded.uid;
  if (!isPatient && !supportUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snap = await db.collection("supportTickets").doc(ticketId).collection("messages").orderBy("createdAt", "asc").get();

  return NextResponse.json({
    messages: snap.docs.map((d) => ({
      messageId: d.id,
      ...d.data(),
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await params;

  const db = getAdminFirestore();
  const auth = getAdminAuth();
  const ticketRef = db.collection("supportTickets").doc(ticketId);
  const ticket = await ticketRef.get();

  if (!ticket.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supportUser = await isSupport(decoded.uid);
  const ticketData = ticket.data()!;
  const isPatient = ticketData.patientUid === decoded.uid;

  if (!isPatient && !supportUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (supportUser && !isPatient) {
    if (ticketData.assignedTo && ticketData.assignedTo !== decoded.uid) {
      return NextResponse.json({ error: "LOCKED: assigned to another agent" }, { status: 403 });
    }
  }

  let body: {
    text: string;
    attachments?: Array<{ url: string; name: string; type: string }>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text?.trim() && !body.attachments?.length) {
    return NextResponse.json({ error: "text or attachment required" }, { status: 400 });
  }

  let senderEmail = "";
  try {
    const u = await auth.getUser(decoded.uid);
    senderEmail = u.email || "";
  } catch {
    /* ignore */
  }

  const now = new Date().toISOString();
  const isFromSupport = supportUser && !isPatient;

  const msgRef = await ticketRef.collection("messages").add({
    senderUid: decoded.uid,
    senderRole: isFromSupport ? "support" : "patient",
    senderEmail,
    text: body.text?.trim() || "",
    attachments: body.attachments ?? [],
    createdAt: now,
    read: false,
  });

  const ticketUpdates: Record<string, unknown> = {
    updatedAt: now,
  };
  if (isFromSupport) {
    ticketUpdates.patientUnread = FieldValue.increment(1);
    ticketUpdates.status = "in-progress";
    if (!ticketData.assignedTo) {
      ticketUpdates.assignedTo = decoded.uid;
      ticketUpdates.assignedEmail = senderEmail;
    }
  } else {
    ticketUpdates.supportUnread = FieldValue.increment(1);
  }
  await ticketRef.update(ticketUpdates);

  const recipientUid = isFromSupport ? ticketData.patientUid : ticketData.assignedTo;

  if (recipientUid) {
    await db
      .collection("notifications")
      .doc(recipientUid)
      .collection("items")
      .add({
        type: "support_message",
        ticketId,
        subject: ticketData.subject,
        preview: body.text?.slice(0, 80) || "Attachment",
        from: isFromSupport ? "support" : "patient",
        fromEmail: senderEmail,
        read: false,
        createdAt: now,
      });
  }

  return NextResponse.json({
    success: true,
    messageId: msgRef.id,
  });
}
