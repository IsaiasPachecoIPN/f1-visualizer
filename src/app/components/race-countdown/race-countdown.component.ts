import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-race-countdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="countdown-overlay" *ngIf="visible" [class.formation-lap]="isFormationLap">
      <div class="countdown-modal">
        <div class="countdown-header" *ngIf="isFormationLap">
          <h2>🏁 Formation Lap</h2>
          <p>Drivers are preparing for the race start...</p>
          <div class="formation-indicators">
            <div class="indicator" *ngFor="let i of [1,2,3,4,5]" [class.active]="animationStep >= i"></div>
          </div>
        </div>
        
        <div class="countdown-header" *ngIf="!isFormationLap && showCountdown">
          <h2>🏎️ Race Start</h2>
          <p>Get ready for the lights out!</p>
        </div>

        <div class="countdown-display" *ngIf="showCountdown">
          <div class="countdown-number" [class.red-light]="countdownNumber === 0">
            {{ countdownNumber === 0 ? 'GO!' : countdownNumber }}
          </div>
          
          <div class="lights-display">
            <div class="light" 
                 *ngFor="let light of lights; let i = index" 
                 [class.on]="light.on"
                 [class.red]="light.color === 'red'"
                 [class.off]="!light.on && light.color === 'red'">
            </div>
          </div>
        </div>

        <div class="countdown-footer" *ngIf="isFormationLap">
          <button class="skip-button" (click)="skipToRaceStart()">
            Skip to Race Start
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .countdown-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    }

    .countdown-overlay.formation-lap {
      background: rgba(0, 0, 50, 0.95);
    }

    .countdown-modal {
      background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
      border-radius: 20px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      border: 2px solid #ff6b35;
      min-width: 400px;
      animation: modalAppear 0.5s ease-out;
    }

    @keyframes modalAppear {
      from {
        opacity: 0;
        transform: scale(0.8) translateY(-50px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .countdown-header h2 {
      color: #ff6b35;
      font-size: 2.5em;
      margin: 0 0 10px 0;
      text-shadow: 0 0 20px rgba(255, 107, 53, 0.5);
    }

    .countdown-header p {
      color: #ccc;
      font-size: 1.2em;
      margin: 0 0 30px 0;
    }

    .formation-indicators {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin: 20px 0;
    }

    .indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #333;
      transition: all 0.3s ease;
    }

    .indicator.active {
      background: #ff6b35;
      box-shadow: 0 0 10px rgba(255, 107, 53, 0.7);
    }

    .countdown-display {
      margin: 30px 0;
    }

    .countdown-number {
      font-size: 8em;
      font-weight: bold;
      color: #fff;
      text-shadow: 0 0 30px rgba(255, 255, 255, 0.5);
      margin-bottom: 20px;
      transition: all 0.3s ease;
      animation: pulse 1s infinite alternate;
    }

    .countdown-number.red-light {
      color: #ff0000;
      text-shadow: 0 0 30px rgba(255, 0, 0, 0.8);
      animation: flash 0.3s infinite;
    }

    @keyframes pulse {
      from { transform: scale(1); }
      to { transform: scale(1.05); }
    }

    @keyframes flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .lights-display {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin: 20px 0;
    }

    .light {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #333;
      border: 2px solid #666;
      transition: all 0.2s ease;
    }

    .light.red.on {
      background: #ff0000;
      border-color: #ff0000;
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.8);
    }

    .light.red.off {
      background: #330000;
      border-color: #660000;
    }

    .countdown-footer {
      margin-top: 30px;
    }

    .skip-button {
      background: rgba(255, 107, 53, 0.2);
      border: 1px solid #ff6b35;
      color: #ff6b35;
      padding: 12px 24px;
      border-radius: 25px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.3s ease;
    }

    .skip-button:hover {
      background: rgba(255, 107, 53, 0.3);
      transform: translateY(-2px);
    }
  `]
})
export class RaceCountdownComponent implements OnInit, OnDestroy {
  @Input() visible = false;
  @Input() isFormationLap = false;
  @Input() startCountdown = false;
  @Output() countdownComplete = new EventEmitter<void>();
  @Output() skipRequested = new EventEmitter<void>();

  countdownNumber = 3;
  showCountdown = false;
  animationStep = 0;
  
  lights = [
    { on: false, color: 'red' },
    { on: false, color: 'red' },
    { on: false, color: 'red' },
    { on: false, color: 'red' },
    { on: false, color: 'red' }
  ];

  private countdownInterval?: any;
  private formationInterval?: any;

  ngOnInit() {
    if (this.isFormationLap) {
      this.startFormationAnimation();
    }
  }

  ngOnDestroy() {
    this.clearIntervals();
  }

  private clearIntervals() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.formationInterval) {
      clearInterval(this.formationInterval);
    }
  }

  private startFormationAnimation() {
    this.animationStep = 0;
    this.formationInterval = setInterval(() => {
      this.animationStep++;
      if (this.animationStep > 5) {
        this.animationStep = 1;
      }
    }, 800);
  }

  startRaceCountdown() {
    this.clearIntervals();
    this.showCountdown = true;
    this.countdownNumber = 3;
    
    // Start with 3-2-1 countdown
    this.countdownInterval = setInterval(() => {
      if (this.countdownNumber > 0) {
        // Light up one more light
        const lightIndex = 3 - this.countdownNumber;
        if (lightIndex >= 0 && lightIndex < this.lights.length) {
          this.lights[lightIndex].on = true;
        }
        
        this.countdownNumber--;
      } else {
        // All lights out - GO!
        this.lights.forEach(light => light.on = false);
        this.countdownNumber = 0; // Show "GO!"
        
        setTimeout(() => {
          this.countdownComplete.emit();
          this.visible = false;
        }, 1500);
        
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  skipToRaceStart() {
    this.skipRequested.emit();
  }
}
