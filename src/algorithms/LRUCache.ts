import { LRUCache, Node } from "../types/LRUCache.interface.ts";
import { MAX_IN_FLIGHT } from '../constants/dedupe.constants.ts';

export function createLRUCache<K, V>(maxSize: number = MAX_IN_FLIGHT ): LRUCache<K, V> {
  const safeMax =
    Number.isInteger(maxSize) && maxSize > 0 ? maxSize : 1_000;

  const head: Node<K, V> = {
    key: null as unknown as K,
    value: null as unknown as V,
    prev: null,
    next: null,
  };
  const tail: Node<K, V> = {
    key: null as unknown as K,
    value: null as unknown as V,
    prev: head,
    next: null,
  };
  head.next = tail;

  const map = new Map<K, Node<K, V>>();

  function detach(node: Node<K, V>): void {
    const p = node.prev!;
    const n = node.next!;
    p.next = n;
    n.prev = p;
    node.prev = null;
    node.next = null;
  }

  function insertFront(node: Node<K, V>): void {
    node.prev = head;
    node.next = head.next;
    head.next!.prev = node;
    head.next = node;
  }

  function evictLRU(): void {
    const lru = tail.prev;
    if (lru === null || lru === head) return;
    detach(lru);
    map.delete(lru.key);
  }

  function set(key: K, value: V): void {
    const existing = map.get(key);
    if (existing !== undefined) {
      existing.value = value;
      detach(existing);
      insertFront(existing);
      return;
    }

    if (map.size >= safeMax) {
      evictLRU();
    }

    const node: Node<K, V> = { key, value, prev: null, next: null };
    insertFront(node);
    map.set(key, node);
  }

  function get(key: K): V | undefined {
    const node = map.get(key);
    if (node === undefined) return undefined;
    detach(node);
    insertFront(node);
    return node.value;
  }

  function peek(key: K): V | undefined {
    return map.get(key)?.value;
  }

  function deleteKey(key: K): boolean {
    const node = map.get(key);
    if (node === undefined) return false;
    detach(node);
    map.delete(key);
    return true;
  }

  function size(): number {
    return map.size;
  }

  function clear(): void {
    map.clear();
    head.next = tail;
    tail.prev = head;
  }

  return { set, get, peek, delete: deleteKey, size, clear };
}