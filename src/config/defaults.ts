import { ALLOWED_METHODS, DEBUG_DEFAULT, MAX_IN_FLIGHT, TTL_MS } from "../constants/dedupe.constants.ts";
import type { DedupeOptions } from "../types/DedupeOptions.interface.ts"; 

export const DEFAULT_OPTIONS: Readonly<DedupeOptions> = {
  ttl:     TTL_MS,
  maxSize: MAX_IN_FLIGHT,
  methods: ALLOWED_METHODS,
  debug:   DEBUG_DEFAULT,
};