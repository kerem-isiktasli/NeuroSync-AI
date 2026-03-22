import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { verifyFirebaseIdToken } from "@/lib/verifyFirebaseIdToken";
import {
  parseNicknameInput,
  registryKeyFromDisplay,
} from "@/lib/nicknameUtils";
import type { DocumentData } from "firebase-admin/firestore";
import type { PatientProfile } from "@/types/intake";
import { EMPTY_PATIENT_PROFILE } from "@/types/intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NICKNAMES = "nicknames";
const USERS = "users";

type PatchBody = { nickname?: string | null };

function mergeUserProfile(data: DocumentData | undefined): PatientProfile {
  const p = data?.profile;
  if (!p || typeof p !== "object") {
    return { ...EMPTY_PATIENT_PROFILE };
  }
  return { ...EMPTY_PATIENT_PROFILE, ...p } as PatientProfile;
}

export async function PATCH(request: Request) {
  const session = await verifyFirebaseIdToken(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawNickname = body.nickname;
  const clearing =
    rawNickname === null ||
    rawNickname === undefined ||
    (typeof rawNickname === "string" && !rawNickname.trim());

  try {
    const db = getAdminFirestore();
    const uid = session.uid;
    const userRef = db.collection(USERS).doc(uid);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const mergedProfile = mergeUserProfile(userSnap.data());
      const oldDisplay = mergedProfile.nickname;
      const oldKey =
        oldDisplay && String(oldDisplay).trim()
          ? registryKeyFromDisplay(String(oldDisplay))
          : null;

      const now = new Date().toISOString();

      if (clearing) {
        if (oldKey) {
          const oldNickRef = db.collection(NICKNAMES).doc(oldKey);
          const oldNickSnap = await tx.get(oldNickRef);
          if (oldNickSnap.exists) {
            const owner = oldNickSnap.data()?.uid as string | undefined;
            if (owner === uid) {
              tx.delete(oldNickRef);
            }
          }
        }
        tx.set(
          userRef,
          {
            profile: {
              ...mergedProfile,
              nickname: null,
              updatedAt: now,
            },
          },
          { merge: true }
        );
        return;
      }

      if (typeof rawNickname !== "string") {
        throw new Error("VALIDATION:nickname must be a string");
      }

      const parsed = parseNicknameInput(rawNickname);
      if (!parsed.ok) {
        throw new Error(`VALIDATION:${parsed.code}`);
      }

      if (oldKey && oldKey !== parsed.key) {
        const oldNickRef = db.collection(NICKNAMES).doc(oldKey);
        const oldNickSnap = await tx.get(oldNickRef);
        if (oldNickSnap.exists) {
          const owner = oldNickSnap.data()?.uid as string | undefined;
          if (owner === uid) {
            tx.delete(oldNickRef);
          }
        }
      }

      const newNickRef = db.collection(NICKNAMES).doc(parsed.key);
      const newNickSnap = await tx.get(newNickRef);
      if (newNickSnap.exists) {
        const owner = newNickSnap.data()?.uid as string | undefined;
        if (owner !== uid) {
          throw new Error("CONFLICT");
        }
      }

      tx.set(newNickRef, { uid, nickname: parsed.display });
      tx.set(
        userRef,
        {
          profile: {
            ...mergedProfile,
            nickname: parsed.display,
            updatedAt: now,
          },
        },
        { merge: true }
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "CONFLICT") {
      return NextResponse.json(
        { error: "nickname_taken", message: "This nickname is already in use." },
        { status: 409 }
      );
    }
    if (msg.startsWith("VALIDATION:")) {
      const code = msg.replace("VALIDATION:", "");
      return NextResponse.json({ error: "validation", code }, { status: 400 });
    }
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
    console.error("[profile/nickname PATCH]", msg);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
