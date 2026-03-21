import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_TOKENS = {
  free: { report: 3, agent: 10, support: 5 },
  pro: { report: 30, agent: 100, support: 50 },
  enterprise: { report: 999999, agent: 999999, support: 999999 },
} as const;

type TokenType = "report" | "agent" | "support";
type Plan = keyof typeof PLAN_TOKENS;

function toJsDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string") return new Date(v);
  return new Date();
}

function getNextResetDate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

function buildDefaultCredits(plan: Plan) {
  const t = PLAN_TOKENS[plan] ?? PLAN_TOKENS.free;
  const now = new Date().toISOString();
  return {
    plan,
    reportTokens: t.report,
    agentTokens: t.agent,
    supportTokens: t.support,
    reportTokensUsed: 0,
    agentTokensUsed: 0,
    supportTokensUsed: 0,
    reportTokensTotal: t.report,
    agentTokensTotal: t.agent,
    supportTokensTotal: t.support,
    resetAt: getNextResetDate(),
    createdAt: now,
    updatedAt: now,
  };
}

function migrateLegacyCredits(data: Record<string, unknown>, plan: Plan) {
  const t = PLAN_TOKENS[plan] ?? PLAN_TOKENS.free;
  const oldBalance = typeof data.balance === "number" ? data.balance : 0;
  const reportRemaining = Math.min(Math.max(0, oldBalance), t.report);
  const now = new Date().toISOString();
  return {
    plan,
    reportTokens: reportRemaining,
    agentTokens: t.agent,
    supportTokens: t.support,
    reportTokensUsed: Math.max(0, t.report - reportRemaining),
    agentTokensUsed: 0,
    supportTokensUsed: 0,
    reportTokensTotal: t.report,
    agentTokensTotal: t.agent,
    supportTokensTotal: t.support,
    resetAt: getNextResetDate(),
    createdAt: (typeof data.createdAt === "string" && data.createdAt) || now,
    updatedAt: now,
  };
}

async function verifyAuth(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}

// GET — fetch current user's token balances
export async function GET(request: Request) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminFirestore();
  const ref = db.collection("credits").doc(decoded.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const defaults = buildDefaultCredits("free");
    await ref.set(defaults);
    return NextResponse.json(defaults);
  }

  const raw = snap.data()!;
  const data = raw as Record<string, unknown>;

  // Legacy or partial docs → three pools
  if (typeof data.reportTokens !== "number") {
    const plan = (data.plan === "pro" || data.plan === "enterprise" ? data.plan : "free") as Plan;
    const migrated =
      typeof data.balance === "number"
        ? migrateLegacyCredits(data, plan)
        : {
            ...buildDefaultCredits(plan),
            createdAt:
              typeof data.createdAt === "string" && data.createdAt ? data.createdAt : new Date().toISOString(),
          };
    await ref.set(migrated);
    return NextResponse.json(migrated);
  }

  const plan = (data.plan === "pro" || data.plan === "enterprise" ? data.plan : "free") as Plan;

  // Monthly reset
  const now = new Date();
  const resetAt = data.resetAt != null ? toJsDate(data.resetAt) : now;
  if (now >= resetAt) {
    const t = PLAN_TOKENS[plan] ?? PLAN_TOKENS.free;
    const resetData = {
      reportTokens: t.report,
      agentTokens: t.agent,
      supportTokens: t.support,
      reportTokensUsed: 0,
      agentTokensUsed: 0,
      supportTokensUsed: 0,
      reportTokensTotal: t.report,
      agentTokensTotal: t.agent,
      supportTokensTotal: t.support,
      resetAt: getNextResetDate(),
      updatedAt: now.toISOString(),
    };
    await ref.update(resetData);
    return NextResponse.json({ ...data, ...resetData });
  }

  return NextResponse.json(data);
}

// POST — deduct a token
export async function POST(request: Request) {
  const decoded = await verifyAuth(request);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { type?: string };
  try {
    body = (await request.json()) as { type?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.type || !["report", "agent", "support"].includes(body.type)) {
    return NextResponse.json({ error: "Invalid token type" }, { status: 400 });
  }

  const tokenType = body.type as TokenType;

  const db = getAdminFirestore();
  const ref = db.collection("credits").doc(decoded.uid);

  let newBalance = 0;
  let insufficient = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    let data: Record<string, unknown>;
    if (!snap.exists) {
      data = buildDefaultCredits("free");
      tx.set(ref, data);
    } else {
      data = { ...snap.data() } as Record<string, unknown>;
      if (typeof data.reportTokens !== "number") {
        const plan = (data.plan === "pro" || data.plan === "enterprise" ? data.plan : "free") as Plan;
        data =
          typeof data.balance === "number"
            ? migrateLegacyCredits(data, plan)
            : {
                ...buildDefaultCredits(plan),
                createdAt:
                  typeof data.createdAt === "string" && data.createdAt ? data.createdAt : new Date().toISOString(),
              };
        tx.set(ref, data);
      }
    }

    const balanceKey = `${tokenType}Tokens`;
    const usedKey = `${tokenType}TokensUsed`;
    const current = typeof data[balanceKey] === "number" ? (data[balanceKey] as number) : 0;

    if (current <= 0) {
      insufficient = true;
      return;
    }

    newBalance = current - 1;
    tx.update(ref, {
      [balanceKey]: newBalance,
      [usedKey]: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });
  });

  if (insufficient) {
    return NextResponse.json({ error: "INSUFFICIENT_TOKENS", type: tokenType }, { status: 402 });
  }

  return NextResponse.json({
    success: true,
    type: tokenType,
    newBalance,
  });
}
