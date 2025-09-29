import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimationControlService } from '../../services/animation-control.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-time-display',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="time-display">
      <div class="race-time">
        <h3>Race Time</h3>
        <div class="current-time">{{ formatTime(currentTime$ | async) }}</div>
        <div class="speed-indicator">{{ (speedMultiplier$ | async) }}x Speed</div>
      </div>
    </div>
  `,
  styles: [`
    .time-display {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      margin: 10px 0;
      color: white;
      font-family: 'Courier New', monospace;
    }

    .race-time h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #ff6b35;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .current-time {
      font-size: 18px;
      font-weight: bold;
      color: #00ff00;
      text-align: center;
      margin-bottom: 8px;
      letter-spacing: 1px;
    }

    .speed-indicator {
      font-size: 12px;
      color: #888;
      text-align: center;
      font-weight: normal;
    }
  `]
})
export class TimeDisplayComponent implements OnInit {
  currentTime$: Observable<Date | null>;
  speedMultiplier$: Observable<number>;

  constructor(private animationControlService: AnimationControlService) {
    this.currentTime$ = this.animationControlService.currentTime$;
    this.speedMultiplier$ = this.animationControlService.speedMultiplier$;
  }

  ngOnInit(): void {
    // No manual subscriptions needed with async pipe
  }

  formatTime(time: Date | null): string {
    if (!time) {
      return '--:--:--';
    }
    
    // Format as HH:MM:SS in 24-hour format
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  }
}
