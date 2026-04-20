import { LOG_PREFIX } from "../shared";

export function logHit(key: string, debug: boolean): void {
  if (debug) console.log(`${LOG_PREFIX.HIT} ${key}`);
};

export function logMiss(key: string, debug: boolean): void {
  if (debug) console.log(`${LOG_PREFIX.MISS} ${key}`);
};

export function logTtlExpiry(key: string, debug: boolean): void {
  if (debug) console.log(`${LOG_PREFIX.TTL_EXPIRE} ${key}`);
};