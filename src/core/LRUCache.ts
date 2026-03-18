export function createLRUCache<K, V>(maxSize: number = 1000): {
  set: (key: K, value: V) => void;
  get: (key: K) => V | undefined;
  peek: (key: K) => V | undefined;
  size: () => number;
  clear: () => void;
} {
  const map = new Map<K, V>();

  return {
    set(key: K, value: V): void {
      if (map.has(key)) {
        map.delete(key);
      } else if (map.size >= maxSize) {
        const oldestKey = map.keys().next().value;
        if (oldestKey !== undefined) {
          map.delete(oldestKey);
        }
      }
      map.set(key, value);
    },

    get(key: K): V | undefined {
      if (!map.has(key)) return undefined;
      const value = map.get(key)!;
      map.delete(key);
      map.set(key, value);
      return value;
    },

    peek(key: K): V | undefined {
      return map.get(key);
    },

    size(): number {
      return map.size;
    },
    clear(): void {
      map.clear();
    },
  };
}
