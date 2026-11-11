import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PairedDeviceDto } from '../api/api.models';
import { DeviceConfigStore } from './device-config.store';

const pairing: PairedDeviceDto = {
  deviceId: 'dev-1',
  deviceToken: 'token',
  companyId: 'co-1',
  branchId: 'br-1',
  cashRegisterId: 'reg-1',
  cashRegisterName: 'Caja 1',
};

describe('DeviceConfigStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('builds the configuration from the pairing response', () => {
    const c = DeviceConfigStore.fromPairing(pairing, ' c2 ');
    expect(c).toMatchObject({ deviceToken: 'token', companyId: 'co-1', branchId: 'br-1', cashRegisterId: 'reg-1', ticketPrefix: 'C2' });
  });

  it('is paired with the token and the register', () => {
    const store = TestBed.inject(DeviceConfigStore);
    expect(store.isPaired()).toBe(false);
    store.save(DeviceConfigStore.fromPairing(pairing, 'C1'));
    expect(store.isPaired()).toBe(true);
    store.unpair();
    expect(store.isPaired()).toBe(false);
  });

  it('a configuration from the previous system (no company) forces pairing again', () => {
    localStorage.setItem('bakerypos.device', JSON.stringify({ deviceToken: 't', branchId: 'b', cashRegisterId: 'r', paymentMethods: [] }));
    expect(TestBed.inject(DeviceConfigStore).config()).toBeNull();
  });
});
