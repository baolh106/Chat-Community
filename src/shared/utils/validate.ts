import type { ZodType, ZodTypeDef } from "zod";
import { BadRequestError } from "./error";

export function parseInput<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) =>
        issue.path.length > 0
          ? `${issue.path.join(".")}: ${issue.message}`
          : issue.message,
      )
      .join("; ");
    throw new BadRequestError(`Validation failed: ${detail}`);
  }
  return result.data;
}
