import type { Request, Response, NextFunction } from "express";
import { ActiveTimerMap, buildCacheKey, createDedupeMap, DedupeMap, DEFAULT_OPTIONS, logHit, logMiss, registerInFlight, replayExistingResponse, RequestKeyBuilder, SettledResponse, shouldSkipRequest } from "../shared";
import { DedupeOptions } from "../types/DedupeOptions.interface";

export function dedupe(userOptions: Partial<DedupeOptions> = {}) {
  const options: DedupeOptions = { ...DEFAULT_OPTIONS, ...userOptions };
  const dedupeMap: DedupeMap<string, SettledResponse> = createDedupeMap(
    options.maxSize,
  );
  const activeTimers: ActiveTimerMap = new Map();
  const keyBuilder = new RequestKeyBuilder(options.trie);

  return function dedupeMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    try {
      if (shouldSkipRequest(req, options)) return next();

      const key = buildCacheKey(req, options, keyBuilder);
      const existingPromise = dedupeMap.getInFlight(key);

      if (existingPromise !== undefined) {
        logHit(key, options.debug);
        replayExistingResponse(existingPromise, res, next);
        return;
      }

      logMiss(key, options.debug);
      registerInFlight(req, res, next, key, options, dedupeMap, activeTimers);
    } catch (err) {
      next(err);
    }
  };
}
