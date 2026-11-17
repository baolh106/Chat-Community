import type { Request, Response } from "express";
import type { ZodError } from "zod";
import { z } from "zod";
import type { IErrorAlerter } from "../../alerting/error-alerter.interface";
import { AppError, BadRequestError, NotFoundError } from "../../utils/error";
import {
  createErrorHandler,
  normalizeError,
  notFoundHandler,
} from "../errorHandler.middleware";

function mockRes() {
  const res = {
    headersSent: false,
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

const req = { method: "GET", originalUrl: "/api/x" } as Request;

describe("errorHandler", () => {
  let alerter: jest.Mocked<IErrorAlerter>;

  beforeEach(() => {
    alerter = { alert: jest.fn() };
  });

  function run(err: unknown) {
    const res = mockRes();
    createErrorHandler(alerter)(err, req, res as unknown as Response, jest.fn());
    return res;
  }

  it("should not alert when a BadRequestError is thrown", () => {
    const res = run(new BadRequestError("bad input"));

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "BAD_REQUEST", message: "bad input" });
    expect(alerter.alert).not.toHaveBeenCalled();
  });

  it("should not alert when a route is not found", () => {
    const next = jest.fn();
    notFoundHandler(req, {} as Response, next);
    const res = run(next.mock.calls[0][0]);

    expect(res.statusCode).toBe(404);
    expect(alerter.alert).not.toHaveBeenCalled();
  });

  it("should alert once when an unknown error is thrown", () => {
    const res = run(new Error("db exploded"));

    expect(res.statusCode).toBe(500);
    expect(alerter.alert).toHaveBeenCalledTimes(1);
    expect(alerter.alert).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, context: "GET /api/x" }),
    );
  });

  it("should alert when a non-operational AppError is thrown", () => {
    run(new AppError("drive down", 502, "FILE_STORAGE_ERROR", false));
    expect(alerter.alert).toHaveBeenCalledTimes(1);
  });

  it("should not write a second response when headers were already sent", () => {
    const res = mockRes();
    res.headersSent = true;
    createErrorHandler(alerter)(new Error("late"), req, res as unknown as Response, jest.fn());
    expect(res.statusCode).toBe(0);
  });
});

describe("normalizeError", () => {
  it("should keep AppError subclasses intact when they are passed", () => {
    const err = new NotFoundError("nope");
    expect(normalizeError(err)).toBe(err);
  });

  it("should map ZodError to 400 when validation fails", () => {
    const result = z.object({ a: z.string() }).safeParse({});
    const err = normalizeError((result as { error: ZodError }).error);
    expect(err.statusCode).toBe(400);
    expect(err.isOperational).toBe(true);
  });

  it("should map multer file size errors to 413 when upload is too large", () => {
    const err = normalizeError({ name: "MulterError", code: "LIMIT_FILE_SIZE", message: "File too large" });
    expect(err.statusCode).toBe(413);
  });

  it("should map body-parser 4xx errors to operational errors when JSON is malformed", () => {
    const err = normalizeError({ status: 400, type: "entity.parse.failed", message: "Unexpected token" });
    expect(err.statusCode).toBe(400);
    expect(err.isOperational).toBe(true);
  });

  it("should map Mongo duplicate key to 409 when unique index is violated", () => {
    expect(normalizeError({ code: 11000, message: "E11000" }).statusCode).toBe(409);
  });
});
