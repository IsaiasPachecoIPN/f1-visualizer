import { Component } from '@angular/core';
import { AnimationControlService } from '../../services/animation-control.service';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { CommonModule } from '@angular/common';
import { ZardSwitchComponent } from '@shared/components/switch/switch.component';

@Component({
  selector: 'app-controls',
  standalone: true,
  templateUrl: './controls.component.html',
  imports: [CommonModule, ZardButtonComponent, ZardSwitchComponent],
})
export class ControlsComponent {
  constructor(private animationControlService: AnimationControlService) {}

  onStart(): void {
    this.animationControlService.start();
  }

  onPause(): void {
    this.animationControlService.pause();
  }

  onStop(): void {
    this.animationControlService.stop();
  }

  onToggleShowAllDrivers(): void {
    this.animationControlService.toggleShowAllDrivers();
  }
}
