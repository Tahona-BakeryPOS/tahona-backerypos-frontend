import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Lo que global-setup crea en la empresa de pruebas (archivo local, no versionado). */
export interface E2EState {
  apiUrl: string;
  ownerEmail: string;
  ownerPassword: string;
  branchName: string;
  cashRegisterName: string;
  pairingCode: string;
  cashier: { name: string; pin: string };
  supervisor: { name: string; pin: string };
  product: { name: string; price: number };
}

export const STATE_FILE = join(__dirname, '.state.json');

export function loadState(): E2EState {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as E2EState;
}

/** Igual que CopPipe: $ 12.500 (sin decimales). Para buscar montos en pantalla sin depender del espacio. */
export function copDigits(value: number): RegExp {
  return new RegExp(Math.round(value).toLocaleString('es-CO').replace(/\./g, '\\.'));
}
