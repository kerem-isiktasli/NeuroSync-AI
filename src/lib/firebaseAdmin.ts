/**
 * Firebase Admin SDK — server-side only.
 * MUST target neurosync-e6846 (client Firebase project).
 * NEVER use GOOGLE_APPLICATION_CREDENTIALS — that is for Vertex/iron-figure.
 */
import { initializeApp, getApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import { readFileSync } from "fs";

const REQUIRED_FIREBASE_PROJECT = "neurosync-e6846";

function getAdminApp() {
  if (getApps().length === 0) {
    const envPath = process.env.FIREBASE_APPLICATION_CREDENTIALS;
    if (!envPath) {
      throw new Error(
        "[firebaseAdmin] FIREBASE_APPLICATION_CREDENTIALS is required. " +
        "Use neurosync-e6846 service account. Do NOT use GOOGLE_APPLICATION_CREDENTIALS for Firebase Admin."
      );
    }
    const keyPath = path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
    const key = JSON.parse(readFileSync(keyPath, "utf8"));
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || key.project_id;
    if (key.project_id !== REQUIRED_FIREBASE_PROJECT && key.project_id !== projectId) {
      throw new Error(
        `[firebaseAdmin] Credential project_id (${key.project_id}) must be ${REQUIRED_FIREBASE_PROJECT}. ` +
        "Use a service account from the Firebase (neurosync) project, not Vertex/iron-figure."
      );
    }
    return initializeApp({
      credential: cert(key),
      projectId: projectId || REQUIRED_FIREBASE_PROJECT,
    });
  }
  return getApp();
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}
