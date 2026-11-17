import {
  BadRequestError,
  TooManyRequestError,
  UnauthorizedError,
} from "../../../../shared/utils/error";
import type { IAdminInfrastructure } from "../../domain/admin.infra";
import { AuthApplication } from "../auth.application";
import type { ILoginRateLimiter } from "../ports/login-rate-limiter.port";
import type { IRefreshTokenStore } from "../ports/refresh-token-store.port";
import type { ITokenService } from "../ports/token.port";

function setup() {
  let counter = 0;
  const tokens: jest.Mocked<ITokenService> = {
    issue: jest.fn(() => {
      counter += 1;
      return { accessToken: `a${counter}`, refreshToken: `r${counter}`, expiresIn: 900000 };
    }),
    verify: jest.fn(),
    refreshTokenTtlSeconds: jest.fn(() => 604800),
  };
  const store = new Map<string, string>();
  const refreshStore: jest.Mocked<IRefreshTokenStore> = {
    save: jest.fn(async (id, token) => {
      store.set(id, token);
    }),
    get: jest.fn(async (id) => store.get(id) ?? null),
    revoke: jest.fn(async (id) => {
      store.delete(id);
    }),
  };
  const limiter: jest.Mocked<ILoginRateLimiter> = {
    consume: jest.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
    reset: jest.fn(async () => undefined),
  };
  const admin: jest.Mocked<IAdminInfrastructure> = {
    verifyPassword: jest.fn(async (pw) => pw === "correct"),
  };
  const app = new AuthApplication(admin, tokens, refreshStore, limiter);
  return { app, tokens, refreshStore, limiter, admin, store };
}

describe("AuthApplication", () => {
  describe("startUserSession", () => {
    it("should store the refresh token with TTL in seconds when session starts", async () => {
      const { app, refreshStore } = setup();
      await app.startUserSession({ nickname: " bob " });

      const [principal, token, ttl] = refreshStore.save.mock.calls[0]!;
      expect(principal).toMatch(/^bob_\d+$/);
      expect(token).toBe("r1");
      expect(ttl).toBe(604800);
    });

    it("should reject when nickname is empty", async () => {
      const { app } = setup();
      await expect(app.startUserSession({ nickname: "   " })).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe("loginAdmin", () => {
    it("should reject without checking password when rate limit is exceeded", async () => {
      const { app, limiter, admin } = setup();
      limiter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 120 });

      await expect(app.loginAdmin("correct", "1.2.3.4")).rejects.toBeInstanceOf(TooManyRequestError);
      expect(admin.verifyPassword).not.toHaveBeenCalled();
    });

    it("should return 401 and keep the counter when password is wrong", async () => {
      const { app, limiter } = setup();
      await expect(app.loginAdmin("wrong", "1.2.3.4")).rejects.toBeInstanceOf(UnauthorizedError);
      expect(limiter.consume).toHaveBeenCalledWith("1.2.3.4");
      expect(limiter.reset).not.toHaveBeenCalled();
    });

    it("should reset the counter and store admin refresh token when password is correct", async () => {
      const { app, limiter, store } = setup();
      await app.loginAdmin("correct", "1.2.3.4");
      expect(limiter.reset).toHaveBeenCalledWith("1.2.3.4");
      expect(store.get("admin")).toBe("r1");
    });
  });

  describe("refreshToken", () => {
    it("should verify as refresh type and rotate the stored token", async () => {
      const { app, tokens, store } = setup();
      store.set("bob_1", "old-refresh");
      tokens.verify.mockReturnValue({ ok: true, claims: { role: "user", userId: "bob_1" } });

      await app.refreshToken("old-refresh");

      expect(tokens.verify).toHaveBeenCalledWith("old-refresh", "refresh");
      expect(store.get("bob_1")).toBe("r1");
    });

    it("should reject a previously rotated token when it is reused", async () => {
      const { app, tokens, store } = setup();
      store.set("bob_1", "newest");
      tokens.verify.mockReturnValue({ ok: true, claims: { role: "user", userId: "bob_1" } });

      await expect(app.refreshToken("stale")).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("should reject when the token is not a valid refresh token", async () => {
      const { app, tokens } = setup();
      tokens.verify.mockReturnValue({ ok: false, reason: "invalid" });
      await expect(app.refreshToken("access-token")).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe("endUserSession", () => {
    it("should revoke only the caller's refresh token", async () => {
      const { app, refreshStore } = setup();
      await app.endUserSession({ role: "user", userId: "bob_1" });
      expect(refreshStore.revoke).toHaveBeenCalledWith("bob_1");
    });
  });
});
