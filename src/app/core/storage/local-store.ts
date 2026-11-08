/**
 * Adaptador sobre Web Storage. El navegador puede negar el acceso (modo privado, cuota),
 * así que ninguna lectura o escritura debe tumbar la app.
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
      /* sin almacenamiento disponible: se conserva solo en memoria */
    }
  }
}
