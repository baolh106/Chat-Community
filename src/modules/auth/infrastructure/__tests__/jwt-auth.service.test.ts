import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { JwtAuthService } from "../jwt-auth.service";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function makeService(overrides: Partial<{ accessTokenExpiresIn: string }> = {}) {
  return new JwtAuthService({
    privateKey,
    publicKey,
    accessTokenExpiresIn: overrides.accessTokenExpiresIn ?? "15m",
    refreshTokenExpiresIn: "7d",
  });
}

describe("JwtAuthService", () => {
  it("should accept an access token when verifying as access", () => {
    const service = makeService();
    const { accessToken } = service.issue({ role: "user", userId: "bob_1", nickname: "bob" });

    expect(service.verify(accessToken, "access")).toEqual({
      ok: true,
      claims: { role: "user", userId: "bob_1", nickname: "bob" },
    });
  });

  it("should reject a refresh token when verifying as access", () => {
    const service = makeService();
    const { refreshToken } = service.issue({ role: "admin" });

    expect(service.verify(refreshToken, "access")).toEqual({ ok: false, reason: "invalid" });
    expect(service.verify(refreshToken, "refresh").ok).toBe(true);
  });

  it("should reject legacy tokens when they have no type claim", () => {
    const service = makeService();
    const legacy = jwt.sign({ role: "admin" }, privateKey, { algorithm: "RS256" });

    expect(service.verify(legacy, "access").ok).toBe(false);
  });

  it("should reject user tokens when userId is missing", () => {
    const service = makeService();
    const forged = jwt.sign({ role: "user", type: "access" }, privateKey, { algorithm: "RS256" });

    expect(service.verify(forged, "access").ok).toBe(false);
  });

  it("should report expired when the token has expired", () => {
    const service = makeService();
    const expired = jwt.sign(
      { role: "admin", type: "access", exp: Math.floor(Date.now() / 1000) - 10 },
      privateKey,
      { algorithm: "RS256" },
    );

    expect(service.verify(expired, "access")).toEqual({ ok: false, reason: "expired" });
  });

  it("should reject tokens when signed with a different key", () => {
    const service = makeService();
    const other = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const forged = jwt.sign({ role: "admin", type: "access" }, other.privateKey, {
      algorithm: "RS256",
    });

    expect(service.verify(forged, "access")).toEqual({ ok: false, reason: "invalid" });
  });

  it("should report refresh TTL in seconds", () => {
    expect(makeService().refreshTokenTtlSeconds()).toBe(7 * 24 * 60 * 60);
  });
});
