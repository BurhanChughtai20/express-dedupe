import { createLRUCache } from "../algorithms/LRUCache.ts";
import type { LRUCache } from "../types/LRUCache.interface.ts";
import type { PromiseStore } from "../types/PromiseStore.interface.ts";
import { MAX_IN_FLIGHT } from "../constants/dedupe.constants.ts";

export function createPromiseStore<K, V>(
  maxSize: number = MAX_IN_FLIGHT 
): PromiseStore<K, V> {
  const safeMax =
    Number.isInteger(maxSize) && maxSize > 0 ? maxSize : MAX_IN_FLIGHT;

  const cache: LRUCache<K, Promise<V>> = createLRUCache<K, Promise<V>>(safeMax);

  function store(key: K, promise: Promise<V>): void {
    cache.set(key, promise);
  }

  function retrieve(key: K): Promise<V> | undefined {
    return cache.get(key);
  }

  function remove(key: K): boolean {
    return cache.delete(key);
  }

  function size(): number {
    return cache.size();
  }

  function clear(): void {
    cache.clear();
  }

  return { store, retrieve, remove, size, clear };
}