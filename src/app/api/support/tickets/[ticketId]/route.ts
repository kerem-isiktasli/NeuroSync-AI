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

export async function PATCH(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId } = await params;

  const supportUser = await isSupport(decoded.uid);
  const db = getAdminFirestore();
  const ref = db.collection("supportTickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ticket = snap.data()!;

  let body: {
    status?: string;
    assign?: boolean;
    unassign?: boolean;
    clearPatientUnread?: boolean;
    clearSupportUnread?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!supportUser) {
    if (body.clearPatientUnread && ticket.patientUid === decoded.uid) {
      await ref.update({
        patientUnread: 0,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.assign) {
    if (ticket.assignedTo && ticket.assignedTo !== decoded.uid) {
      return NextResponse.json({ error: "Already assigned to another agent" }, { status: 409 });
    }
    const auth = getAdminAuth();
    let assignedEmail = "";
    try {
      const u = await auth.getUser(decoded.uid);
      assignedEmail = u.email || "";
    } catch {
      /* ignore */
    }
    await ref.update({
      assignedTo: decoded.uid,
      assignedEmail,
      status: "in-progress",
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  }

  if (body.unassign) {
    if (ticket.assignedTo !== decoded.uid) {
      return NextResponse.json({ error: "Not your ticket" }, { status: 403 });
    }
    await ref.update({
      assignedTo: null,
      assignedEmail: null,
      status: "open",
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.status) updates.status = body.status;
  if (body.clearSupportUnread) updates.supportUnread = 0;
  await ref.update(updates);
  return NextResponse.json({ success: true });
}
