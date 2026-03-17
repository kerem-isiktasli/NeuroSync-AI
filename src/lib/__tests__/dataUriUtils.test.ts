/**
 * Data URI utils — test robust extraction for DICOM (empty MIME, octet-stream).
 */
import { describe, it, expect } from "vitest";
import { extractDataUriMeta } from "../dataUriUtils";

describe("extractDataUriMeta", () => {
  it("extracts from data:;base64,xxx (empty MIME)", () => {
    const payload = "SGVsbG8gV29ybGQ=";
    const dataUri = `data:;base64,${payload}`;
    const { mimeType, base64 } = extractDataUriMeta(dataUri);
    expect(mimeType).toBe("application/octet-stream");
    expect(base64).toBe(payload);
  });

  it("extracts from data:application/octet-stream;base64,xxx", () => {
    const payload = "SGVsbG8=";
    const dataUri = `data:application/octet-stream;base64,${payload}`;
    const { mimeType, base64 } = extractDataUriMeta(dataUri);
    expect(mimeType).toBe("application/octet-stream");
    expect(base64).toBe(payload);
  });

  it("extracts from data:image/jpeg;base64,xxx", () => {
    const payload = "/9j/4AAQ";
    const dataUri = `data:image/jpeg;base64,${payload}`;
    const { mimeType, base64 } = extractDataUriMeta(dataUri);
    expect(mimeType).toBe("image/jpeg");
    expect(base64).toBe(payload);
  });

  it("decodes empty MIME base64 to valid buffer", () => {
    const dataUri = "data:;base64,SGVsbG8=";
    const { base64 } = extractDataUriMeta(dataUri);
    const buf = Buffer.from(base64, "base64");
    expect(buf.toString()).toBe("Hello");
  });

  it("handles DICOM-like base64 (DICM at 128)", () => {
    const filler = "A".repeat(128);
    const dicm = "DICM";
    const rest = "B".repeat(100);
    const b64 = Buffer.from(filler + dicm + rest, "binary").toString("base64");
    const dataUri = `data:;base64,${b64}`;
    const { base64 } = extractDataUriMeta(dataUri);
    const buf = Buffer.from(base64, "base64");
    expect(buf.length).toBeGreaterThanOrEqual(132);
    expect(buf[128]).toBe(0x44);
    expect(buf[129]).toBe(0x49);
    expect(buf[130]).toBe(0x43);
    expect(buf[131]).toBe(0x4d);
  });

  it("OLD BUG: data:;base64, would have failed before fix", () => {
    const payload = Buffer.alloc(132);
    payload[128] = 0x44;
    payload[129] = 0x49;
    payload[130] = 0x43;
    payload[131] = 0x4d;
    const b64 = payload.toString("base64");
    const dataUri = `data:;base64,${b64}`;
    const { base64: extracted } = extractDataUriMeta(dataUri);
    expect(extracted).toBe(b64);
    const decoded = Buffer.from(extracted, "base64");
    expect(decoded[128]).toBe(0x44);
    expect(decoded[131]).toBe(0x4d);
  });
});
