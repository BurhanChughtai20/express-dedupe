export { RequestKeyBuilder } from "../core/RequestKey";
export { LOG_PREFIX } from "../constants/dedupe.constants";

export { ActiveTimerMap, DedupeMap, SettledResponse } from '../types/DedupeMap.interface';
export { NO_TTL } from "../constants/dedupe.constants";
export { scheduleTtlExpiry } from "../core/ttlManager";
export { patchResponseForSettlement } from "../middleware/internal/responsePatch";

export { logTtlExpiry } from "../utils/logger";

export { ERROR_MESSAGE, RESPONSE_EVENT } from "../constants/dedupe.constants";

export { createDedupeMap } from "../core/DedupeMap.ts";
export { DEFAULT_OPTIONS } from "../config/defaults.ts";
export { shouldSkipRequest } from "../middleware/internal/skip-req.ts";
export { replayExistingResponse } from "../middleware/internal/replay.ts";
export { registerInFlight } from "../middleware/internal/inflight.ts";
export { buildCacheKey } from "../utils/cacheKey.ts";
export { logHit, logMiss } from "../utils/logger.ts";

export type { PromiseStore } from "../types/PromiseStore.interface.ts";
export { createPromiseStore } from "../core/PromiseStore.ts";
export { MAX_IN_FLIGHT } from "../constants/dedupe.constants.ts"; 

export { createLRUCache } from "../algorithms/LRUCache.ts";
export type { LRUCache } from "../types/LRUCache.interface.ts";

export { KEY_SEPARATOR } from "../constants/dedupe.constants.ts";
export { UrlPatternTrie } from "../algorithms/Trie.ts";

export type { HTTPMethod } from "../types/DedupeOptions.interface.ts";

export {
  ALLOWED_METHODS,
  DEBUG_DEFAULT,
  TTL_MS,
} from "../constants/dedupe.constants.ts";

export {  Node } from "../types/LRUCache.interface.ts";