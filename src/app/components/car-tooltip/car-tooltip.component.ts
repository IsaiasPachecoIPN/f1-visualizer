import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DriverCarData } from '../../services/position.service';

@Component({
  selector: 'app-car-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="car-tooltip" [style.left.px]="x" [style.top.px]="y" *ngIf="visible && driverData">
      <div class="tooltip-header">
        <span class="driver-number" [style.background-color]="driverData.teamColor">
          {{ driverData.driverNumber }}
        </span>
        <span class="driver-name">{{ driverData.driverName }}</span>
      </div>
      
      <div class="tooltip-content" *ngIf="driverData.carData">
        <div class="car-data-row">
          <span class="label">Speed:</span>
          <span class="value">{{ driverData.carData.speed }} km/h</span>
        </div>
        <div class="car-data-row">
          <span class="label">Gear:</span>
          <span class="value">{{ getGearDisplay(driverData.carData.n_gear) }}</span>
        </div>
        <div class="car-data-row">
          <span class="label">RPM:</span>
          <span class="value">{{ driverData.carData.rpm | number:'1.0-0' }}</span>
        </div>
        <div class="car-data-row">
          <span class="label">Throttle:</span>
          <span class="value throttle">
            <div class="throttle-bar">
              <div class="throttle-fill" [style.width.%]="driverData.carData.throttle"></div>
            </div>
            {{ driverData.carData.throttle }}%
          </span>
        </div>
        <div class="car-data-row">
          <span class="label">Brake:</span>
          <span class="value brake" [class.active]="driverData.carData.brake > 0">
            {{ driverData.carData.brake > 0 ? 'ON' : 'OFF' }}
          </span>
        </div>
        <div class="car-data-row">
          <span class="label">DRS:</span>
          <span class="value drs" [class.active]="driverData.carData.drs > 0">
            {{ getDRSDisplay(driverData.carData.drs) }}
          </span>
        </div>
      </div>
      
      <div class="tooltip-content" *ngIf="!driverData.carData">
        <div class="car-data-row">
          <span class="value no-data">No car data available</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .car-tooltip {
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      min-width: 200px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .tooltip-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .driver-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      font-size: 11px;
    }

    .driver-name {
      font-weight: bold;
      color: #fff;
    }

    .tooltip-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .car-data-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
    }

    .label {
      color: #ccc;
      font-size: 11px;
    }

    .value {
      font-weight: bold;
      color: #fff;
    }

    .value.throttle {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .throttle-bar {
      width: 40px;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
    }

    .throttle-fill {
      height: 100%;
      background: linear-gradient(to right, #00ff00, #ffff00, #ff0000);
      transition: width 0.1s ease;
    }

    .value.brake.active {
      color: #ff4444;
    }

    .value.drs.active {
      color: #44ff44;
    }

    .no-data {
      color: #888;
      font-style: italic;
    }
  `]
})
export class CarTooltipComponent {
  @Input() visible = false;
  @Input() x = 0;
  @Input() y = 0;
  @Input() driverData: any = null;

  getGearDisplay(gear: number): string {
    if (gear === 0) return 'N';
    return gear.toString();
  }

  getDRSDisplay(drs: number): string {
    // DRS values: 0 = Off, 1 = Available, 2 = Enabled
    switch (drs) {
      case 0: return 'OFF';
      case 1: return 'AVAILABLE';
      case 2: return 'ENABLED';
      default: return 'OFF';
    }
  }
}
