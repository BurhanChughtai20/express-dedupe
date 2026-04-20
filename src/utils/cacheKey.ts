import { Request } from "express";
import { RequestKeyBuilder } from "../shared";
import { DedupeOptions } from "../types/DedupeOptions.interface";

export function buildCacheKey(
  req: Request,
  options: DedupeOptions,
  keyBuilder: RequestKeyBuilder
): string {
  return options.keyGenerator ? options.keyGenerator(req) : keyBuilder.build(req);
}
