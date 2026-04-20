import { ALLOWED_METHODS, DEBUG_DEFAULT, MAX_IN_FLIGHT, TTL_MS } from "../shared";
import { DedupeOptions } from "../types/DedupeOptions.interface";


export const DEFAULT_OPTIONS: Readonly<DedupeOptions> = {
  ttl:     TTL_MS,
  maxSize: MAX_IN_FLIGHT,
  methods: ALLOWED_METHODS,
  debug:   DEBUG_DEFAULT,
};