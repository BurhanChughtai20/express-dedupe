import { Request } from "express";
import { DedupeOptions } from "../../types/DedupeOptions.interface";

export function shouldSkipRequest(
  req: Request,
  options: DedupeOptions,
): boolean {
  return (
    !options.methods.includes(req.method as never) ||
    options.skip?.(req) === true
  );
}
