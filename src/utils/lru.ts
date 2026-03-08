type LRUNode<K, V> = {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
};

export default class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly cache = new Map<K, LRUNode<K, V>>();

  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("LRUCache capacity must be a positive integer");
    }
    this.capacity = capacity;
  }

  get size() {
    return this.cache.size;
  }

  has(key: K) {
    return this.cache.has(key);
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      return undefined;
    }

    this.move_to_head(node);
    return node.value;
  }

  peek(key: K): V | undefined {
    return this.cache.get(key)?.value;
  }

  set(key: K, value: V) {
    const existing = this.cache.get(key);
    if (existing) {
      existing.value = value;
      this.move_to_head(existing);
      return;
    }

    const node: LRUNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
    };

    this.cache.set(key, node);
    this.insert_to_head(node);

    if (this.cache.size > this.capacity) {
      this.evict_lru();
    }
  }

  del(key: K) {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    this.detach(node);
    this.cache.delete(key);
    return true;
  }

  clear() {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  entries() {
    const result: [K, V][] = [];
    let cursor = this.head;

    while (cursor) {
      result.push([cursor.key, cursor.value]);
      cursor = cursor.next;
    }

    return result;
  }

  private move_to_head(node: LRUNode<K, V>) {
    if (this.head === node) {
      return;
    }

    this.detach(node);
    this.insert_to_head(node);
  }

  private insert_to_head(node: LRUNode<K, V>) {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private detach(node: LRUNode<K, V>) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }

  private evict_lru() {
    const node = this.tail;
    if (!node) {
      return;
    }

    this.detach(node);
    this.cache.delete(node.key);
  }
}
