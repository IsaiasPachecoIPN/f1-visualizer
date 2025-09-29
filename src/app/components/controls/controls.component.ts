import { FormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { AnimationControlService } from '../../services/animation-control.service';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { CommonModule } from '@angular/common';
import { ZardSwitchComponent } from '@shared/components/switch/switch.component';

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

  constructor(
    private animationControlService: AnimationControlService,
    private openf1ApiService: Openf1ApiService
  ) {}

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
}
