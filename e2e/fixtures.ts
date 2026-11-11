import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What global-setup creates in the test company (local file, not versioned). */
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

/** Same as CopPipe: $ 12.500 (no decimals). To find amounts on screen without depending on the space. */
export function copDigits(value: number): RegExp {
  return new RegExp(Math.round(value).toLocaleString('es-CO').replace(/\./g, '\\.'));
}
