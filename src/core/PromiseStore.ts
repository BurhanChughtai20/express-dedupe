import { createLRUCache } from "./LRUCache.ts";

export function createPromiseStore<K, V>(maxSize: number = 1000) {
  const cache = createLRUCache<K, Promise<V>>(maxSize);

  return {
    store(key: K, promise: Promise<V>): void {
      cache.set(key, promise);
    },

    retrieve(key: K): Promise<V> | undefined {
      return cache.get(key);
    },

    remove(key: K): void {
      cache.set(key, undefined as unknown as Promise<V>);
    },

    size(): number {
      return cache.size();
    },

    clear(): void {
      cache.clear();
    }
  };
}