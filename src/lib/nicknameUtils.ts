/**
 * Shared nickname parsing for registry keys (Firestore doc id) and display strings.
 * Used by API routes and optional client hints.
 */

const MIN_KEY_LEN = 3;
const MAX_DISPLAY_LEN = 32;
const MAX_KEY_LEN = 64;

export type NicknameParseErrorCode =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_key"
  | "key_too_long";

export type NicknameParseResult =
  | { ok: true; key: string; display: string }
  | { ok: false; code: NicknameParseErrorCode };

/**
 * Build a stable registry key from a display nickname (Turkish-aware lowercasing).
 */
export function registryKeyFromDisplay(display: string): string {
  const t = display
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return t.slice(0, MAX_KEY_LEN);
}

/**
 * Validate raw user input and produce registry key + canonical display (trimmed, length-capped).
 */
export function parseNicknameInput(raw: string): NicknameParseResult {
  const display = raw.trim().normalize("NFKC");
  if (!display) {
    return { ok: false, code: "empty" };
  }
  if (display.length > MAX_DISPLAY_LEN) {
    return { ok: false, code: "too_long" };
  }
  const key = registryKeyFromDisplay(display);
  if (!key) {
    return { ok: false, code: "invalid_key" };
  }
  if (key.length < MIN_KEY_LEN) {
    return { ok: false, code: "too_short" };
  }
  if (key.length > MAX_KEY_LEN) {
    return { ok: false, code: "key_too_long" };
  }
  return { ok: true, key, display };
}
