/**
 * Firestore storage layer for patient data.
 *
 * OBJECT 1: PatientProfile — stored in `users/{uid}` under `profile` field
 * OBJECT 2: AnalysisIntake — stored in `analysisIntakes/{intakeId}`
 *
 * Profile is per-user, reusable.
 * AnalysisIntake is per-report, linked by analysisId and userId.
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PatientProfile, AnalysisIntake } from "@/types/intake";
import { EMPTY_PATIENT_PROFILE, EMPTY_ANALYSIS_INTAKE } from "@/types/intake";

const USERS_COLLECTION = "users";
const INTAKES_COLLECTION = "analysisIntakes";

// ═══════════════════════════════════════════════════════════════════
// OBJECT 1: Patient Profile (lives in users/{uid}.profile)
// ═══════════════════════════════════════════════════════════════════

export async function loadPatientProfile(uid: string): Promise<PatientProfile> {
  const snap = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (!snap.exists()) return { ...EMPTY_PATIENT_PROFILE };
  const data = snap.data();
  if (!data.profile || typeof data.profile !== "object") return { ...EMPTY_PATIENT_PROFILE };
  return { ...EMPTY_PATIENT_PROFILE, ...data.profile } as PatientProfile;
}

export async function savePatientProfile(
  uid: string,
  profile: Partial<PatientProfile>
): Promise<void> {
  const now = new Date().toISOString();
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    { profile: { ...profile, updatedAt: now } },
    { merge: true }
  );
}

// ═══════════════════════════════════════════════════════════════════
// OBJECT 2: Analysis Intake (lives in analysisIntakes collection)
// ═══════════════════════════════════════════════════════════════════

export async function saveAnalysisIntake(
  intake: AnalysisIntake
): Promise<string> {
  const now = new Date().toISOString();
  // Strip undefined fields — Firestore rejects them
  const clean: Record<string, unknown> = { createdAt: now };
  for (const [k, v] of Object.entries({ ...intake })) {
    if (v !== undefined && v !== null) clean[k] = v;
  }
  const ref = await addDoc(collection(db, INTAKES_COLLECTION), clean);
  return ref.id;
}

export async function loadAnalysisIntake(
  intakeId: string
): Promise<AnalysisIntake | null> {
  const snap = await getDoc(doc(db, INTAKES_COLLECTION, intakeId));
  if (!snap.exists()) return null;
  return { ...EMPTY_ANALYSIS_INTAKE, ...snap.data() } as AnalysisIntake;
}

export async function loadLatestIntakeForReport(
  userId: string,
  analysisId: string
): Promise<AnalysisIntake | null> {
  const q = query(
    collection(db, INTAKES_COLLECTION),
    where("userId", "==", userId),
    where("analysisId", "==", analysisId),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...EMPTY_ANALYSIS_INTAKE, ...snap.docs[0].data() } as AnalysisIntake;
}

export async function loadLatestIntakeForUser(
  userId: string
): Promise<AnalysisIntake | null> {
  const q = query(
    collection(db, INTAKES_COLLECTION),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...EMPTY_ANALYSIS_INTAKE, ...snap.docs[0].data() } as AnalysisIntake;
}
