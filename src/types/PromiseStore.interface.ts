export interface PromiseStore<K, V> {
  store(key: K, promise: Promise<V>): void;
  retrieve(key: K): Promise<V> | undefined;
  remove(key: K): boolean;
  size(): number;
  clear(): void;
}