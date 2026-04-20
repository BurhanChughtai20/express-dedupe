import { NextFunction, Request, Response } from "express";
import { ActiveTimerMap, DedupeMap, NO_TTL, patchResponseForSettlement, scheduleTtlExpiry, SettledResponse } from "../../shared";
import { DedupeOptions } from "../../types/DedupeOptions.interface";

export function registerInFlight(
  req: Request,
  res: Response,
  next: NextFunction,
  key: string,
  options: DedupeOptions,
  dedupeMap: DedupeMap<string, SettledResponse>,
  activeTimers: ActiveTimerMap
): void {
  let resolveFn!: (value: SettledResponse) => void;
  let rejectFn!: (reason?: unknown) => void;

  const promise = new Promise<SettledResponse>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  dedupeMap.addInFlight(key, promise);

  if (options.ttl > NO_TTL) {
    scheduleTtlExpiry(key, options, dedupeMap, activeTimers);
  }

  patchResponseForSettlement(res, key, dedupeMap, activeTimers, resolveFn, rejectFn);

  next();
}
