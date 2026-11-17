import type { Request, Response } from "express";
import type { ITokenVerifier } from "../../auth/auth-claims";
import { ForbiddenError, UnauthorizedError } from "../../utils/error";
import { createRequireAuth, getAuth, requireRole } from "../auth.middleware";

function run(verifier: ITokenVerifier, authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const res = { locals: {} } as Response;
  const next = jest.fn();
  createRequireAuth(verifier)(req, res, next);
  return { res, next };
}

describe("createRequireAuth", () => {
  const verifier: jest.Mocked<ITokenVerifier> = { verify: jest.fn() };

  it("should reject with 401 when no token is sent", () => {
    const { next } = run(verifier);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("should verify as access token and expose claims when token is valid", () => {
    verifier.verify.mockReturnValueOnce({ ok: true, claims: { role: "user", userId: "u_1" } });
    const { res, next } = run(verifier, "Bearer good");

    expect(verifier.verify).toHaveBeenCalledWith("good", "access");
    expect(next).toHaveBeenCalledWith();
    expect(getAuth(res)).toEqual({ role: "user", userId: "u_1" });
  });

  it("should reject with 401 when token is invalid", () => {
    verifier.verify.mockReturnValueOnce({ ok: false, reason: "invalid" });
    const { next } = run(verifier, "Bearer bad");
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe("requireRole", () => {
  it("should reject with 403 when role does not match", () => {
    const res = { locals: { auth: { role: "user", userId: "u" } } } as unknown as Response;
    const next = jest.fn();
    requireRole("admin")({} as Request, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
