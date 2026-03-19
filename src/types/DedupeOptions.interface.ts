
export type HTTPMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface DedupeOptions {
  ttl:           number;
  maxSize:       number;
  methods:       readonly HTTPMethod[];
  debug:         boolean;
  keyGenerator?: (req: unknown) => string;
  skip?:         (req: unknown) => boolean;
}