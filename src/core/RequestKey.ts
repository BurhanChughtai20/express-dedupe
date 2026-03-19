import type { Request } from "express"; 
import { UrlPatternTrie } from "../algorithms/Trie.ts";
import { KEY_SEPARATOR } from "../constants/dedupe.constants.ts";

const DUMMY_BASE = "http://localhost";
const QUERY_SEPARATOR = "?";
const EMPTY = "";
const TRAILING_SLASH_REGEX = /(?<=.)\/$/;

export type KeyBuilder = (req: Request) => string;

export class RequestKeyBuilder {
  private readonly trie: UrlPatternTrie | null;

  constructor(trie?: UrlPatternTrie) {
    this.trie = trie ?? null;
  }

  build(req: Request): string {
    const method = req.method.toUpperCase();
    const pathname = this.extractPathname(req.url);
    return method + KEY_SEPARATOR + pathname;
  }

  buildWithQuery(req: Request): string {
    const base = this.build(req);
    const query = this.extractQuery(req.url);
    return query ? base + KEY_SEPARATOR + query : base;
  }

  private extractPathname(url: string): string {
    let pathname: string;

    try {
      const parsed = new URL(url, DUMMY_BASE);
      pathname = parsed.pathname
        .toLowerCase()
        .replace(TRAILING_SLASH_REGEX, EMPTY);
    } catch {
      pathname = url.split(QUERY_SEPARATOR)[0].toLowerCase();
    }

    if (this.trie) {
      const match = this.trie.match(pathname);
      if (match) {
        pathname = match.pattern;
      }
    }

    return pathname;
  }

  private extractQuery(url: string): string {
    try {
      const parsed = new URL(url, DUMMY_BASE);
      parsed.searchParams.sort();
      return parsed.searchParams.toString();
    } catch {
      const parts = url.split(QUERY_SEPARATOR);
      return parts.length > 1 ? parts[1] ?? EMPTY : EMPTY;
    }
  }
}