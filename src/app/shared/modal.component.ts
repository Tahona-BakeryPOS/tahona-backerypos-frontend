import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Modal dialog with a backdrop; the content is projected. Escape or a click on the backdrop closes it. */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="scrim" (click)="closed.emit()">
      <div class="card modal" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        @if (eyebrow()) { <div class="cu">{{ eyebrow() }}</div> }
        <h2>{{ title() }}</h2>
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly eyebrow = input<string>('');
  readonly closed = output<void>();
}
