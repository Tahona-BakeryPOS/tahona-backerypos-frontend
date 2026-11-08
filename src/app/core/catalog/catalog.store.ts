import { Injectable, computed, inject, signal } from '@angular/core';
import { PosProduct } from '../api/api.models';
import { PosApi } from '../api/pos-api';
import { DeviceConfigStore } from '../device/device-config.store';

/**
 * Catálogo de la caja: productos que se pueden vender en la sucursal del equipo, con su precio vigente.
 * Vive en memoria (la v2 no vende sin conexión) y se recarga al abrir la venta o a pedido.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly api = inject(PosApi);
  private readonly device = inject(DeviceConfigStore);

  readonly products = signal<PosProduct[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = computed(() => [...new Set(this.products().map((p) => p.category))].sort());

  async refresh(): Promise<void> {
    const branchId = this.device.config()?.branchId;
    if (!branchId) return;
    this.loading.set(true);
    try {
      const products = await this.api.posProducts(branchId);
      this.products.set(products.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
      this.error.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  findByCode(code: string): PosProduct | undefined {
    const c = code.trim().toLowerCase();
    return this.products().find((p) => p.barcode?.toLowerCase() === c || p.sku.toLowerCase() === c);
  }
}
