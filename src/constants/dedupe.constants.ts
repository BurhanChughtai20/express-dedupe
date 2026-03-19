import type { HTTPMethod } from "../types/DedupeOptions.interface.ts";

export const TTL_MS          = 5_000  as const;
export const MAX_IN_FLIGHT   = 1_000  as const;
export const NO_TTL          = 0     as const;
export const DEBUG_DEFAULT   = false  as const;

export const ALLOWED_METHODS = ["GET", "HEAD"] as const satisfies readonly HTTPMethod[];

export const KEY_SEPARATOR = "::" as const;

export const LOG_PREFIX = {
  HIT:        "[dedupe] HIT →",
  MISS:       "[dedupe] MISS →",
  TTL_EXPIRE: "[dedupe] TTL EXPIRE →",
} as const;

export const RESPONSE_EVENT = {
  FINISH: "finish",
  CLOSE:  "close",
  ERROR:  "error",
} as const;

export const ERROR_MESSAGE = {
  CLIENT_DISCONNECTED: "Client disconnected before response completed",
} as const;