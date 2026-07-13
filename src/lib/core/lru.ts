// Tiny capacity-bounded LRU (insertion-order Map; re-insert on access). Replaces
// the previously unbounded caches in render.ts/dye.ts so long sessions don't leak.
export class LRU<V> {
  private m = new Map<string, V>()
  constructor(private cap: number) {}
  get(k: string): V | undefined {
    const v = this.m.get(k)
    if (v !== undefined) { this.m.delete(k); this.m.set(k, v) }
    return v
  }
  has(k: string): boolean { return this.m.has(k) }
  set(k: string, v: V): V {
    if (this.m.has(k)) this.m.delete(k)
    this.m.set(k, v)
    while (this.m.size > this.cap) { const oldest = this.m.keys().next().value; if (oldest === undefined) break; this.m.delete(oldest) }
    return v
  }
}
