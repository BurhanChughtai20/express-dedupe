import { createPromiseStore } from "./PromiseStore.ts";

export interface DedupeMap<K, V> {
  isInFlight   (key: K)                        : boolean;
  addInFlight  (key: K, promise: Promise<V>)   : Promise<V>;
  getInFlight  (key: K)                        : Promise<V> | undefined;
  complete     (key: K)                        : void;
  size         ()                              : number;
  clear        ()                              : void;
}

export function createDedupeMap<K, V>(
  maxSize: number = 1_000
): DedupeMap<K, V> {

  const safeMaxSize = Number.isInteger(maxSize) && maxSize > 0
    ? maxSize
    : 1_000;

  const store = createPromiseStore<K, V>(safeMaxSize);

  function isInFlight(key: K): boolean {
    return store.retrieve(key) !== undefined;
  }

  function addInFlight(key: K, promise: Promise<V>): Promise<V> {

    if (isInFlight(key)) {
      return store.retrieve(key)!;
    }

    if (!(promise instanceof Promise)) {
      return Promise.resolve() as unknown as Promise<V>;
    }

    promise
      .then(() => complete(key))
      .catch(() => complete(key));

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

  return { isInFlight, addInFlight, getInFlight, complete, size, clear };
}