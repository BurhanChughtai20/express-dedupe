import type { DedupeMap } from "../types/DedupeMap.interface.ts";
import type { PromiseStore } from "../types/PromiseStore.interface.ts";
import { createPromiseStore } from "./PromiseStore.ts";
import { MAX_IN_FLIGHT } from "../constants/dedupe.constants.ts"; 

export function createDedupeMap<K, V>(
  maxSize: number = MAX_IN_FLIGHT 
): DedupeMap<K, V> {
  const store: PromiseStore<K, V> = createPromiseStore<K, V>(maxSize);

  function isInFlight(key: K): boolean {
    return store.retrieve(key) !== undefined;
  }

  function addInFlight(key: K, promise: Promise<V>): Promise<V> {
    const existingPromise = store.retrieve(key);
    if (existingPromise !== undefined) {
      return existingPromise;
    }

    if (!isPromise(promise)) {
      return Promise.reject(
        new TypeError(
          `[DedupeMap] addInFlight: expected a Promise for key "${String(key)}", received ${typeof promise}`
        )
      );
    }

    autoCompleteOnSettlement(key, promise);
    store.store(key, promise);
    return promise;
  }

  function getInFlight(key: K): Promise<V> | undefined {
    return store.retrieve(key);
  }

  function complete(key: K): void {
    store.remove(key);
  }

  function size(): number {
    return store.size();
  }

  function clear(): void {
    store.clear();
  }

  function isPromise(value: unknown): value is Promise<V> {
    return value instanceof Promise;
  }

  function autoCompleteOnSettlement(key: K, promise: Promise<V>): void {
    promise.then(
      () => complete(key),
      () => complete(key)
    );
  }

  return { isInFlight, addInFlight, getInFlight, complete, size, clear };
}