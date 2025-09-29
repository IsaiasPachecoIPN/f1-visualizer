import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { AnimationControlService } from '../../services/animation-control.service';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { CommonModule } from '@angular/common';
import { ZardSwitchComponent } from '@shared/components/switch/switch.component';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-controls',
  standalone: true,
  templateUrl: './controls.component.html',
  imports: [
    CommonModule,
    FormsModule,
    ZardButtonComponent,
    ZardSwitchComponent,
  ],
})
export class ControlsComponent implements OnInit {
  sessions: any[] = [];
  selectedSession: number = 9181;
  speedMultiplier$: Observable<number>;
  speedOptions = [
    { value: 0.25, label: '0.25x' },
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x' },
    { value: 2, label: '2x' },
    { value: 5, label: '5x' },
    { value: 10, label: '10x' },
    { value: 20, label: '20x' },
    { value: 50, label: '50x' }
  ];

  constructor(
    private animationControlService: AnimationControlService,
    private openf1ApiService: Openf1ApiService
  ) {
    this.speedMultiplier$ = this.animationControlService.speedMultiplier$;
  }

  ngOnInit(): void {
    this.openf1ApiService.getSessions(2023).subscribe(sessions => {
      this.sessions = sessions;
    });
  }

  onSessionChange(event: Event): void {
    const sessionKey = (event.target as HTMLSelectElement).value;
    this.selectedSession = parseInt(sessionKey, 10);
    this.openf1ApiService.setSessionKey(this.selectedSession);
    this.animationControlService.changeSession(this.selectedSession);
  }

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

  onSpeedChange(event: Event): void {
    const speed = parseFloat((event.target as HTMLSelectElement).value);
    this.animationControlService.setSpeedMultiplier(speed);
  }

  increaseSpeed(): void {
    const currentSpeed = this.animationControlService.getSpeedMultiplier();
    const currentIndex = this.speedOptions.findIndex(option => option.value === currentSpeed);
    if (currentIndex < this.speedOptions.length - 1) {
      const newSpeed = this.speedOptions[currentIndex + 1].value;
      this.animationControlService.setSpeedMultiplier(newSpeed);
    }
  }

  decreaseSpeed(): void {
    const currentSpeed = this.animationControlService.getSpeedMultiplier();
    const currentIndex = this.speedOptions.findIndex(option => option.value === currentSpeed);
    if (currentIndex > 0) {
      const newSpeed = this.speedOptions[currentIndex - 1].value;
      this.animationControlService.setSpeedMultiplier(newSpeed);
    }
  }
}
