import { ChangeDetectionStrategy, Component, output } from '@angular/core';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back' | 'ok';

/** Touch numeric keypad (64 px targets) for PINs and amounts. */
@Component({
  selector: 'app-keypad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="keypad">
      @for (k of keys; track k) {
        <button type="button" [class.primary]="k === 'ok'" (click)="pressed.emit(k)" [attr.aria-label]="label(k)">
          {{ k === 'back' ? '⌫' : k === 'ok' ? 'OK' : k }}
        </button>
      }
    </div>
  `,
})
export class KeypadComponent {
  readonly pressed = output<KeypadKey>();
  protected readonly keys: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];

  protected label(k: KeypadKey): string {
    return k === 'back' ? 'Borrar' : k === 'ok' ? 'Aceptar' : k;
  }
}
