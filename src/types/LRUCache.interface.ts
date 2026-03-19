export interface Node<K, V> {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
}
export interface LRUCache<K, V> {
  set(key: K, value: V): void;
  get(key: K): V | undefined;
  peek(key: K): V | undefined;
  delete(key: K): boolean;
  size(): number;
  clear(): void;
}
