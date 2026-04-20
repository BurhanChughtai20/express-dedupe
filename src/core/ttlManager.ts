import { ActiveTimerMap, DedupeMap, logTtlExpiry, SettledResponse } from "../shared";
import { DedupeOptions } from "../types/DedupeOptions.interface";


export function scheduleTtlExpiry(
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