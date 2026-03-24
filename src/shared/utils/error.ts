import { ErrorCode, StatusCode } from "../constants/error.constant";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errorCode: string = ErrorCode.INTERNAL_SERVER_ERROR,
    public isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DomainError extends AppError {
  constructor(message: string) {
    super(message, StatusCode.DOMAIN_ERROR, ErrorCode.DOMAIN_ERROR);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, StatusCode.NOT_FOUND, ErrorCode.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, StatusCode.CONFLICT, ErrorCode.CONFLICT);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, StatusCode.BAD_REQUEST, ErrorCode.BAD_REQUEST);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, StatusCode.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, StatusCode.FORBIDDEN, ErrorCode.FORBIDDEN);
  }
}

export class TooManyRequestError extends AppError {
  constructor(message: string) {
    super(message, StatusCode.TOO_MANY_REQUESTS, ErrorCode.TOO_MANY_REQUESTS);
  }
}
