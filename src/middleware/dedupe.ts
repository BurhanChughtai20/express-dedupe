import type { Request, Response, NextFunction } from "express";
import type { DedupeOptions } from "../types/DedupeOptions.interface.ts";
import type { DedupeMap } from "../types/DedupeMap.interface.ts";
import { createDedupeMap } from "../core/DedupeMap.ts";
import { RequestKeyBuilder } from "../core/RequestKey.ts";
import { DEFAULT_OPTIONS } from "../config/defaults.ts";
import { LOG_PREFIX, NO_TTL, RESPONSE_EVENT, ERROR_MESSAGE } from "../constants/dedupe.constants.ts";

type ActiveTimerMap = Map<string, ReturnType<typeof setTimeout>>;

interface SettledResponse {
  status: number;
  body: unknown;
}

export function dedupe(userOptions: Partial<DedupeOptions> = {}) {
  const options: DedupeOptions = { ...DEFAULT_OPTIONS, ...userOptions };
  const dedupeMap: DedupeMap<string, SettledResponse> = createDedupeMap(options.maxSize);
  const activeTimers: ActiveTimerMap = new Map();
  const keyBuilder = new RequestKeyBuilder(options.trie);

  return function dedupeMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
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

function shouldSkipRequest(req: Request, options: DedupeOptions): boolean {
  return (
    !options.methods.includes(req.method as never) ||
    options.skip?.(req) === true
  );
}

function buildCacheKey(
  req: Request,
  options: DedupeOptions,
  keyBuilder: RequestKeyBuilder
): string {
  return options.keyGenerator ? options.keyGenerator(req) : keyBuilder.build(req);
}

function replayExistingResponse(
  promise: Promise<SettledResponse>,
  res: Response,
  next: NextFunction
): void {
  promise
    .then(({ status, body }) => {
      if (!res.headersSent) res.status(status).json(body);
    })
    .catch((err: unknown) => {
      if (!res.headersSent) next(err);
    });
}

function registerInFlight(
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

function scheduleTtlExpiry(
  key: string,
  options: DedupeOptions,
  dedupeMap: DedupeMap<string, SettledResponse>,
  activeTimers: ActiveTimerMap
): void {
  const timer = setTimeout(() => {
    logTtlExpiry(key, options.debug);
    dedupeMap.complete(key);
    activeTimers.delete(key);
  }, options.ttl);

  activeTimers.set(key, timer);
}

function patchResponseForSettlement(
  res: Response,
  key: string,
  dedupeMap: DedupeMap<string, SettledResponse>,
  activeTimers: ActiveTimerMap,
  resolveFn: (value: SettledResponse) => void,
  rejectFn: (reason?: unknown) => void
): void {
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);

  let isSettled = false;

  function cleanup(): void {
    if (isSettled) return;
    isSettled = true;
    const timer = activeTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(key);
    }
    dedupeMap.complete(key);
  }

  function resolveOnce(body: unknown): void {
    if (isSettled) return;
    resolveFn({ status: res.statusCode, body });
    cleanup();
  }

  function rejectOnce(err: unknown): void {
    if (isSettled) return;
    rejectFn(err);
    cleanup();
  }

  res.json = (body?: unknown): Response => {
    resolveOnce(body);
    return originalJson(body);
  };

  res.send = (body?: unknown): Response => {
    resolveOnce(body);
    return originalSend(body);
  };

  res.once(RESPONSE_EVENT.FINISH, cleanup);
  res.once(RESPONSE_EVENT.CLOSE, () => rejectOnce(new Error(ERROR_MESSAGE.CLIENT_DISCONNECTED)));
}

function logHit(key: string, debug: boolean): void {
  if (debug) console.log(`${LOG_PREFIX.HIT} ${key}`);
}

function logMiss(key: string, debug: boolean): void {
  if (debug) console.log(`${LOG_PREFIX.MISS} ${key}`);
}

function logTtlExpiry(key: string, debug: boolean): void {
  if (debug) console.log(`${LOG_PREFIX.TTL_EXPIRE} ${key}`);
}