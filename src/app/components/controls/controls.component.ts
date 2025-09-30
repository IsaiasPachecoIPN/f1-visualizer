import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { AnimationControlService } from '../../services/animation-control.service';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-controls',
  standalone: true,
  templateUrl: './controls.component.html',
  imports: [
    CommonModule,
    FormsModule,
  ],
})
export class ControlsComponent implements OnInit {
  sessions: any[] = [];
  selectedSession: number = 9181;
  speedMultiplier$: Observable<number>;
  isPlaying$: Observable<boolean>;
  
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
    this.isPlaying$ = this.animationControlService.isPlaying$;
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

  onStartPause(): void {
    console.log('🎮 Start/Pause button pressed, current state:', this.animationControlService.getIsPlaying());
    
    if (this.animationControlService.getIsPlaying()) {
      console.log('⏸️ Pausing simulation');
      this.animationControlService.pause();
    } else {
      console.log('▶️ Starting/Resuming simulation');
      this.animationControlService.start();
    }
  }

  onRestart(): void {
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
