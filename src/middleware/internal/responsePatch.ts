import { Response } from "express";
import { ActiveTimerMap, DedupeMap, ERROR_MESSAGE, RESPONSE_EVENT, SettledResponse } from "../../shared";


export function patchResponseForSettlement(
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