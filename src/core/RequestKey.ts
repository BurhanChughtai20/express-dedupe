import type { Request } from "express";
import { KEY_SEPARATOR } from "../constants/dedupe.constants.ts";

const DUMMY_BASE = "http://localhost" as const;

export type KeyBuilder = (req: Request) => string;
export function buildKey(req: Request): string {
  const method = req.method.toUpperCase();

  let pathname: string;
  try {
    const parsed = new URL(req.url, DUMMY_BASE);
    pathname = parsed.pathname.toLowerCase().replace(/(?<=.)\/$/, "");
  } catch {
    pathname = req.url.split("?")[0].toLowerCase();
  }

  return `${method}${KEY_SEPARATOR}${pathname}`;
}
export function buildKeyWithQuery(req: Request): string {
  const base = buildKey(req);

  let queryPart: string;
  try {
    const parsed = new URL(req.url, DUMMY_BASE);
    parsed.searchParams.sort();
    queryPart = parsed.searchParams.toString();
  } catch {
    queryPart = req.url.includes("?") ? req.url.split("?")[1] ?? "" : "";
  }

  return queryPart ? `${base}${KEY_SEPARATOR}${queryPart}` : base;
}