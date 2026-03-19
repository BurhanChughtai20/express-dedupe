export interface DedupeMap<K, V> {
  isInFlight(key: K): boolean;
  addInFlight(key: K, promise: Promise<V>): Promise<V>;
  getInFlight(key: K): Promise<V> | undefined;
  complete(key: K): void;
  size(): number;
  clear(): void;
}