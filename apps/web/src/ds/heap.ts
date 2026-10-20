/**
 * Binary heap. `before(a, b)` means `a` should be popped sooner than `b`.
 * Used by the transaction scheduler; tested on its own so the ordering rule stays obvious.
 */
export class Heap<T> {
  private readonly data: T[] = [];

  constructor(private readonly before: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.data.length;
  }

  push(value: T): void {
    this.data.push(value);
    this.siftUp(this.data.length - 1);
  }

  peek(): T | undefined {
    return this.data[0];
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop() as T;
    if (this.data.length === 0) return top;
    this.data[0] = last;
    this.siftDown(0);
    return top;
  }

  private siftUp(index: number): void {
    let i = index;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (!this.before(this.data[i], this.data[parent])) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private siftDown(index: number): void {
    let i = index;
    const length = this.data.length;
    for (;;) {
      let best = i;
      const left = i * 2 + 1;
      const right = left + 1;
      if (left < length && this.before(this.data[left], this.data[best])) best = left;
      if (right < length && this.before(this.data[right], this.data[best])) best = right;
      if (best === i) break;
      this.swap(i, best);
      i = best;
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.data[a];
    this.data[a] = this.data[b];
    this.data[b] = tmp;
  }
}
