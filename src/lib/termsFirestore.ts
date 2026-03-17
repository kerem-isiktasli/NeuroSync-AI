import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CURRENT_TERMS_VERSION, TERMS_STORAGE_KEY, TERMS_VERSION_STORAGE_KEY } from "@/lib/terms";

export type TermsAcceptance = {
  termsAccepted: boolean;
  termsAcceptedAt: Timestamp | null;
  termsVersion: string;
};

/**
 * Get stored terms acceptance for a Firebase user.
 * Returns null if doc doesn't exist or user hasn't accepted.
 */
export async function getTermsAcceptance(userId: string): Promise<TermsAcceptance | null> {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    termsAccepted: data.termsAccepted === true,
    termsAcceptedAt: data.termsAcceptedAt ?? null,
    termsVersion: data.termsVersion ?? "",
  };
}

/**
 * Save terms acceptance to Firestore for the given user.
 */
export async function setTermsAcceptance(userId: string): Promise<void> {
  const ref = doc(db, "users", userId);
  await setDoc(ref, {
    termsAccepted: true,
    termsAcceptedAt: serverTimestamp(),
    termsVersion: CURRENT_TERMS_VERSION,
  }, { merge: true });
}

/**
 * Returns true if the user has accepted the current terms version.
 */
export function hasAcceptedCurrentTerms(acceptance: TermsAcceptance | null): boolean {
  if (!acceptance?.termsAccepted) return false;
  return acceptance.termsVersion === CURRENT_TERMS_VERSION;
}
