import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'z-dialog',
  standalone: true,
  template: '<div class="z-dialog-stub"><ng-content></ng-content></div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZardDialogComponent {}
