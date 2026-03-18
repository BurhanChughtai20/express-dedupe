import { Request } from "express";

const SEPARATOR = "::";

export function buildKey(req: Request): string {
  const method = req.method.toUpperCase();
  const parsed = new URL(req.url, "");
  const path   = parsed.pathname.toLowerCase();
  return `${method}${SEPARATOR}${path}`;
}

export type KeyBuilder = (req: Request) => string;