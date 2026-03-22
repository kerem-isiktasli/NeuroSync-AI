import { describe, it, expect } from "vitest";
import { parseNicknameInput, registryKeyFromDisplay } from "../nicknameUtils";

describe("registryKeyFromDisplay", () => {
  it("lowers Turkish İ to ascii i", () => {
    const k = registryKeyFromDisplay("İstanbul");
    expect(k).toBe("istanbul");
  });

  it("replaces spaces with hyphen", () => {
    expect(registryKeyFromDisplay("Alex M")).toBe("alex-m");
  });
});

describe("parseNicknameInput", () => {
  it("accepts valid nickname", () => {
    const r = parseNicknameInput("MedUser_42");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.display).toBe("MedUser_42");
      expect(r.key.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("rejects empty", () => {
    expect(parseNicknameInput("   ").ok).toBe(false);
  });

  it("rejects too long display", () => {
    expect(parseNicknameInput("a".repeat(40)).ok).toBe(false);
  });
});
