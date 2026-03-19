export interface MatchResult {
  pattern: string;
  params: Record<string, string>;
}

class TrieNode {
  staticChildren = new Map<string, TrieNode>();
  paramChild: TrieNode | null = null;
  paramName: string | null = null;
  wildcardChild: TrieNode | null = null;
  pattern: string | null = null;
}

const SEGMENT_SEPARATOR = "/";
const EMPTY = "";
const PARAM_PREFIX = ":";
const WILDCARD = "*";
const ROOT_INDEX = 0;
const STEP = 1;

export class UrlPatternTrie {
  private readonly root = new TrieNode();

  insert(pattern: string): void {
    const segments = this.split(pattern);
    let node = this.root;

    for (const segment of segments) {
      if (segment === WILDCARD) {
        if (!node.wildcardChild) {
          node.wildcardChild = new TrieNode();
        }
        node = node.wildcardChild;
        continue;
      }

      if (segment.startsWith(PARAM_PREFIX)) {
        const name = segment.slice(PARAM_PREFIX.length);
        if (!node.paramChild) {
          node.paramChild = new TrieNode();
          node.paramName = name;
        }
        node = node.paramChild;
        continue;
      }

      if (!node.staticChildren.has(segment)) {
        node.staticChildren.set(segment, new TrieNode());
      }

      node = node.staticChildren.get(segment)!;
    }

    node.pattern = pattern;
  }

  match(pathname: string): MatchResult | null {
    const segments = this.split(pathname);
    return this.traverse(this.root, segments, ROOT_INDEX, {});
  }

  private traverse(
    node: TrieNode,
    segments: readonly string[],
    depth: number,
    params: Record<string, string>
  ): MatchResult | null {
    if (depth === segments.length) {
      return node.pattern
        ? { pattern: node.pattern, params }
        : null;
    }

    const segment = segments[depth];

    const staticChild = node.staticChildren.get(segment);
    if (staticChild) {
      const result = this.traverse(staticChild, segments, depth + STEP, params);
      if (result) return result;
    }

    if (node.paramChild) {
      const nextParams = { ...params, [node.paramName!]: segment };
      const result = this.traverse(
        node.paramChild,
        segments,
        depth + STEP,
        nextParams
      );
      if (result) return result;
    }

    if (node.wildcardChild) {
      const nextParams = { ...params, [WILDCARD]: segment };
      const result = this.traverse(
        node.wildcardChild,
        segments,
        depth + STEP,
        nextParams
      );
      if (result) return result;
    }

    return null;
  }

  private split(path: string): string[] {
    return path
      .toLowerCase()
      .split(SEGMENT_SEPARATOR)
      .filter((s) => s !== EMPTY);
  }
}