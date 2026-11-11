import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PosProduct } from '../api/api.models';
import { CartStore } from './cart.store';

const pan: PosProduct = {
  id: 'p1', sku: 'PAN', name: 'Pan', category: 'Panes', price: 2975, priceIncludesTax: true, taxRate: 19, allowsDecimals: false, unitCode: 'UND', barcode: null,
};
const torta: PosProduct = {
  id: 'p2', sku: 'TOR', name: 'Torta', category: 'Tortas', price: 38000, priceIncludesTax: true, taxRate: 0, allowsDecimals: true, unitCode: 'KG', barcode: null,
};

describe('CartStore', () => {
  let cart: CartStore;
  beforeEach(() => {
    TestBed.resetTestingModule();
    cart = TestBed.inject(CartStore);
  });

  it('accumulates units of the same product in one line', () => {
    cart.add(pan);
    cart.add(pan);
    expect(cart.lines()).toHaveLength(1);
    expect(cart.lines()[0].quantity).toBe(2);
    expect(cart.totals().total).toBe(5950);
  });

  it('each weighing is its own line and the step is 0.25', () => {
    cart.add(torta, 0.5);
    cart.add(torta, 1);
    expect(cart.lines()).toHaveLength(2);
    cart.step(cart.lines()[0].key, 1);
    expect(cart.lines()[0].quantity).toBe(0.75);
  });

  it('removing down to zero deletes the line', () => {
    cart.add(pan);
    cart.step(cart.lines()[0].key, -1);
    expect(cart.isEmpty()).toBe(true);
  });

  it('the discount reduces the gross with VAT included', () => {
    cart.add(pan, 2);
    cart.discount(cart.lines()[0].key, 10, 'Cortesía');
    expect(cart.totals()).toEqual({ subtotal: 4500, discount: 595, tax: 855, total: 5355 });
  });
});
