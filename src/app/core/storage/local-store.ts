/**
 * Adapter over Web Storage. The browser may deny access (private mode, quota),
 * so no read or write must bring the app down.
 */
export class LocalStore<T> {
  constructor(
    private readonly key: string,
    private readonly storage: () => Storage = () => localStorage,
  ) {}

  read(): T | null {
    try {
      const raw = this.storage().getItem(this.key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  write(value: T | null): void {
    try {
      if (value === null) this.storage().removeItem(this.key);
      else this.storage().setItem(this.key, JSON.stringify(value));
    } catch {
      /* no storage available: it is kept in memory only */
    }
  }
}
