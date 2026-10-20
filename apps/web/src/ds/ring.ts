/** Fixed window. Oldest entries fall out once the buffer is full. */
export class RingBuffer<T> {
  private readonly data: T[] = [];
  private head = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Ring capacity must be a positive integer");
    }
  }

  push(item: T): void {
    if (this.data.length < this.capacity) {
      this.data.push(item);
      return;
    }
    this.data[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
  }

  toArray(): T[] {
    if (this.data.length < this.capacity) return this.data.slice();
    return [...this.data.slice(this.head), ...this.data.slice(0, this.head)];
  }
}
