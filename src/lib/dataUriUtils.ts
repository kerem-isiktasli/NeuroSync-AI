/**
 * Data URI utilities — robust extraction for file uploads.
 * Handles browser quirks: empty MIME (data:;base64,xxx), application/octet-stream.
 */

export function extractDataUriMeta(
  dataUri: string
): { mimeType: string; base64: string } {
  if (!dataUri || typeof dataUri !== "string") {
    return { mimeType: "application/octet-stream", base64: "" };
  }
  const trimmed = dataUri.trim();
  // Match data:[mime];base64,[payload] — MIME can be empty (data:;base64,xxx)
  const match = trimmed.match(/^data:([^;]*);base64,([\s\S]*)$/);
  if (match) {
    const mime = (match[1] ?? "").trim().toLowerCase() || "application/octet-stream";
    const base64 = (match[2] ?? "").trim();
    return { mimeType: mime, base64 };
  }
  // Fallback: extract base64 after ";base64," (handles malformed data URIs)
  const base64Idx = trimmed.indexOf(";base64,");
  if (base64Idx >= 0) {
    const base64 = trimmed.slice(base64Idx + 8).trim();
    const mimePart = trimmed.slice(5, base64Idx);
    const mime = mimePart.trim().toLowerCase() || "application/octet-stream";
    return { mimeType: mime, base64 };
  }
  if (!trimmed.startsWith("data:")) {
    return { mimeType: "application/octet-stream", base64: trimmed };
  }
  return { mimeType: "application/octet-stream", base64: trimmed };
}
