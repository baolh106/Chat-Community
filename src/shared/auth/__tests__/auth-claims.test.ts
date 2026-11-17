import {
  canAccessConversation,
  isAllowedReceiver,
  normalizeBearerToken,
  principalIdOf,
} from "../auth-claims";

describe("isAllowedReceiver", () => {
  it.each([
    ["user", "admin", true],
    ["user", "otherUser_123", false],
    ["user", "", false],
    ["admin", "user_123", true],
    ["admin", "admin", false],
    ["admin", "", false],
  ] as const)("should return %s -> %s = %s", (role, receiver, expected) => {
    expect(isAllowedReceiver(role, receiver)).toBe(expected);
  });
});

describe("canAccessConversation", () => {
  it("should allow admin when reading any conversation", () => {
    expect(canAccessConversation({ role: "admin" }, "anyone_1")).toBe(true);
  });

  it("should allow user when reading own conversation", () => {
    expect(canAccessConversation({ role: "user", userId: "bob_1" }, "bob_1")).toBe(true);
  });

  it("should deny user when reading someone else's conversation", () => {
    expect(canAccessConversation({ role: "user", userId: "bob_1" }, "alice_2")).toBe(false);
  });

  it("should deny user when token has no userId", () => {
    expect(canAccessConversation({ role: "user" }, "")).toBe(false);
  });
});

describe("principalIdOf / normalizeBearerToken", () => {
  it("should map admin to the admin principal", () => {
    expect(principalIdOf({ role: "admin" })).toBe("admin");
    expect(principalIdOf({ role: "user", userId: "u_1" })).toBe("u_1");
  });

  it("should strip Bearer prefix when present", () => {
    expect(normalizeBearerToken("Bearer abc")).toBe("abc");
    expect(normalizeBearerToken("abc")).toBe("abc");
    expect(normalizeBearerToken("Bearer   ")).toBeUndefined();
    expect(normalizeBearerToken(undefined)).toBeUndefined();
  });
});
