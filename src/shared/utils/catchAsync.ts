import type { NextFunction, Request, RequestHandler, Response } from "express";

export const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
};
