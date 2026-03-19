export { dedupe }                          from "./middleware/dedupe.ts";
export { UrlPatternTrie }                  from "./algorithms/Trie.ts";
export { NO_TTL, TTL_MS, ALLOWED_METHODS } from "./constants/dedupe.constants.ts";

export type { DedupeOptions, HTTPMethod }  from "./types/DedupeOptions.interface.ts";
export type { MatchResult }                from "./algorithms/Trie.ts";