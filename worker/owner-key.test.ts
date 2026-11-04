// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decodeSha256Hex,
  ownerKeyConfigured,
  ownerKeyMatches,
  readPresentedOwnerKey,
  sha256Bytes,
} from "./owner-key";

const comparisons: Array<[Uint8Array, Uint8Array]> = [];

beforeAll(() => {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    configurable: true,
    value: (left: ArrayBufferView, right: ArrayBufferView) => {
      const actual = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
      const expected = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
      comparisons.push([actual.slice(), expected.slice()]);
      if (actual.byteLength !== expected.byteLength) return false;
      let diff = 0;
      for (let index = 0; index < actual.byteLength; index += 1) {
        diff |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
      }
      return diff === 0;
    },
  });
});

afterAll(() => {
  Reflect.deleteProperty(crypto.subtle, "timingSafeEqual");
});

async function hashHex(value: string) {
  const bytes = await sha256Bytes(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("主人密钥比对", () => {
  it("只接受密钥的 SHA-256，并用固定长度做常量时间比较", async () => {
    comparisons.length = 0;
    const key = "correct-horse";
    const hash = await hashHex(key);
    expect(ownerKeyConfigured(hash)).toBe(true);
    expect(ownerKeyConfigured("")).toBe(false);
    expect(ownerKeyConfigured("abcd")).toBe(false);

    await expect(ownerKeyMatches(key, hash)).resolves.toBe(true);
    await expect(ownerKeyMatches("wrong-key", hash)).resolves.toBe(false);
    await expect(ownerKeyMatches(key, "zz")).resolves.toBe(false);

    expect(comparisons.length).toBe(3);
    for (const [actual, expected] of comparisons) {
      expect(actual.byteLength).toBe(32);
      expect(expected.byteLength).toBe(32);
    }
    expect(decodeSha256Hex(hash)).toEqual(await sha256Bytes(key));
  });

  it("从 Bearer 或 X-Lvxu-Owner-Key 读取密钥，不接受其他方案", () => {
    const bearer = new Request("https://lvxu.test/api/auth/check", {
      headers: { authorization: "Bearer local-key" },
    });
    const header = new Request("https://lvxu.test/api/auth/check", {
      headers: { "x-lvxu-owner-key": "header-key" },
    });
    const basic = new Request("https://lvxu.test/api/auth/check", {
      headers: { authorization: "Basic abc" },
    });
    expect(readPresentedOwnerKey(bearer)).toBe("local-key");
    expect(readPresentedOwnerKey(header)).toBe("header-key");
    expect(readPresentedOwnerKey(basic)).toBeNull();
  });
});
