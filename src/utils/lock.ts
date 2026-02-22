export default class Lock {
  private lock: boolean = false;
  private lock_queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    if (this.lock) {
      const promise = new Promise<void>((resolve) => {
        this.lock_queue.push(resolve);
      });
      await promise;
    } else {
      this.lock = true;
    }
  }

  release(): void {
    if (this.lock_queue.length > 0) {
      const next = this.lock_queue.shift();
      if (next) {
        next();
      }
    } else {
      this.lock = false;
    }
  }
}
