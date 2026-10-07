import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  generateRoomCode,
  generateUniqueRoomCode,
  isRoomCode,
  normalizeRoomCode,
} from "./roomCode";

describe("room codes (H-5)", () => {
  it("excludes the ambiguous characters 0, O, 1, I and L", () => {
    for (const ambiguous of "0O1IL") expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
    expect(ROOM_CODE_ALPHABET).toHaveLength(31);
  });

  it("generates valid 6-character codes", () => {
    for (let i = 0; i < 200; i++) expect(isRoomCode(generateRoomCode())).toBe(true);
  });

  it("skips bytes that would bias the distribution", () => {
    const bytes = [255, 248, 0, 1, 2, 3, 4, 5];
    let index = 0;
    const code = generateRoomCode((buffer) => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = bytes[index++ % bytes.length];
    });
    expect(code).toBe("ABCDEF");
  });

  it("normalizes what a student types", () => {
    expect(normalizeRoomCode(" abc-def ")).toBe("ABCDEF");
    expect(isRoomCode("ABCDE")).toBe(false);
    expect(isRoomCode("ABCDE0")).toBe(false);
  });

  it("retries on collision and gives up after repeated collisions", () => {
    const codes = ["AAAAAA", "BBBBBB"];
    expect(generateUniqueRoomCode((code) => code === "AAAAAA", () => codes.shift()!)).toBe("BBBBBB");
    expect(() => generateUniqueRoomCode(() => true, () => "AAAAAA")).toThrow();
  });
});
