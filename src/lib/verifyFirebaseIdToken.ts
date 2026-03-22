import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function verifyFirebaseIdToken(
  request: Request
): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
