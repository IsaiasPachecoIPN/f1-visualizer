import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AnimationControlService } from '../../services/animation-control.service';
import { PositionService, DriverPositionData, RacePositionsTable } from '../../services/position.service';

export interface DriverPosition {
  position: number;
  driverNumber: number;
  driverName: string;
  driverAcronym: string;
  teamColor: string;
  teamName: string;
}

@Component({
  selector: 'app-positions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="positions-container">
      <h3 class="positions-title">
        Race Positions
        <span class="driver-count" *ngIf="raceTable$ | async as table">({{ table.totalDrivers }} drivers)</span>
        <span class="sync-note" title="Live position updates during race simulation">⚡</span>
      </h3>
      
      <div class="positions-list" *ngIf="raceTable$ | async as table">
        <div *ngIf="table.drivers.length === 0" class="no-positions">
          Loading driver positions...
        </div>
        
        <div *ngFor="let driver of table.drivers; let i = index; trackBy: trackByPosition" 
             class="position-item"
             [class.podium]="driver.position <= 3"
             [class.position-change]="hasPositionChanged(driver)">
          <div class="position-number" [ngClass]="getPositionClass(driver.position)">
            {{ driver.position }}
          </div>
          
          <div class="driver-info">
            <div class="driver-color" [style.background-color]="driver.teamColor"></div>
            <div class="driver-details">
              <div class="driver-name">{{ driver.driverAcronym }}</div>
              <div class="team-name">{{ driver.teamName }}</div>
            </div>
          </div>
          
          <div class="position-indicator" *ngIf="getPositionChange(driver) as change">
            <span class="change-arrow" 
                  [class.up]="change > 0" 
                  [class.down]="change < 0"
                  [title]="getChangeTitle(change)">
              {{ change > 0 ? '↗' : '↘' }}
            </span>
          </div>
        </div>
        
        <div class="last-update" *ngIf="table.lastUpdate">
          <small>Last updated: {{ formatTime(table.lastUpdate) }}</small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .positions-container {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      margin: 10px 0;
      color: white;
      font-family: 'Arial', sans-serif;
    }

    .positions-title {
      margin: 0 0 15px 0;
      font-size: 16px;
      color: #ff6b35;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: bold;
      border-bottom: 2px solid #ff6b35;
      padding-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .driver-count {
      font-size: 12px;
      color: #ccc;
      font-weight: normal;
      text-transform: none;
      background: #333;
      padding: 2px 6px;
      border-radius: 10px;
    }

    .sync-note {
      font-size: 12px;
      color: #4CAF50;
      cursor: help;
      opacity: 0.8;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    .sync-note:hover {
      opacity: 1;
      color: #66BB6A;
    }

    .positions-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .position-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      margin-bottom: 6px;
      border-radius: 6px;
      background: #2a2a2a;
      border-left: 4px solid #444;
      transition: all 0.3s ease;
      position: relative;
    }

    .position-item:hover {
      background: #333;
      transform: translateX(2px);
    }

    .position-item.podium {
      border-left-color: #ffd700;
    }

    .position-item.position-change {
      animation: positionUpdate 1s ease-in-out;
      border-left-color: #ff6b35;
    }

    @keyframes positionUpdate {
      0% { background: #ff6b35; }
      100% { background: #2a2a2a; }
    }

    .position-number {
      font-size: 18px;
      font-weight: bold;
      min-width: 30px;
      text-align: center;
      padding: 4px 8px;
      border-radius: 4px;
      margin-right: 12px;
      background: #444;
      color: white;
    }

    .position-number.p1 {
      background: #ffd700;
      color: #000;
    }

    .position-number.p2 {
      background: #c0c0c0;
      color: #000;
    }

    .position-number.p3 {
      background: #cd7f32;
      color: #fff;
    }

    .driver-info {
      display: flex;
      align-items: center;
      flex: 1;
    }

    .driver-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 10px;
      border: 2px solid #fff;
    }

    .driver-details {
      flex: 1;
    }

    .driver-name {
      font-size: 14px;
      font-weight: bold;
      color: #fff;
      margin-bottom: 2px;
    }

    .team-name {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .no-positions {
      text-align: center;
      color: #999;
      font-style: italic;
      padding: 20px;
    }

    .positions-list::-webkit-scrollbar {
      width: 4px;
    }

    .positions-list::-webkit-scrollbar-track {
      background: #333;
      border-radius: 2px;
    }

    .positions-list::-webkit-scrollbar-thumb {
      background: #666;
      border-radius: 2px;
    }

    .positions-list::-webkit-scrollbar-thumb:hover {
      background: #888;
    }

    .position-indicator {
      margin-left: auto;
      display: flex;
      align-items: center;
    }

    .change-arrow {
      font-size: 16px;
      font-weight: bold;
      padding: 2px 4px;
      border-radius: 4px;
      transition: all 0.3s ease;
    }

    .change-arrow.up {
      color: #4CAF50;
      background: rgba(76, 175, 80, 0.1);
    }

    .change-arrow.down {
      color: #f44336;
      background: rgba(244, 67, 54, 0.1);
    }

    .last-update {
      text-align: center;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #444;
    }

    .last-update small {
      color: #888;
      font-size: 10px;
    }
  `]
})
export class PositionsComponent implements OnInit, OnDestroy {
  positions$: Observable<DriverPosition[]>;
  raceTable$: Observable<RacePositionsTable>;
  private subscriptions: Subscription[] = [];
  private previousPositions: Map<number, number> = new Map(); // driverNumber -> previousPosition

  constructor(
    private animationControlService: AnimationControlService,
    private positionService: PositionService
  ) {
    // Keep the legacy observable for backwards compatibility
    this.positions$ = this.positionService.currentPositions$.pipe(
      map(positions => positions.map(pos => ({
        position: pos.position,
        driverNumber: pos.driverNumber,
        driverName: pos.driverName || `Driver ${pos.driverNumber}`,
        driverAcronym: pos.driverAcronym || `#${pos.driverNumber}`,
        teamColor: pos.teamColor || '#888888',
        teamName: pos.teamName || 'Unknown'
      })))
    );

    // New race table observable - this is what we'll primarily use
    this.raceTable$ = this.positionService.raceTable$;
  }

  ngOnInit(): void {
    // Position updates are now handled automatically by PositionService
    console.log('🏁 Positions component initialized - using enhanced PositionService for complete race table');
    
    // Subscribe to race table updates to track position changes
    const raceTableSub = this.raceTable$.subscribe(table => {
      this.updatePositionChangeTracking(table.drivers);
    });
    
    this.subscriptions.push(raceTableSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private updatePositionChangeTracking(drivers: DriverPositionData[]): void {
    drivers.forEach(driver => {
      this.previousPositions.set(driver.driverNumber, driver.position);
    });
  }

  getPositionClass(position: number): string {
    switch (position) {
      case 1: return 'p1';
      case 2: return 'p2';
      case 3: return 'p3';
      default: return '';
    }
  }

  trackByPosition(index: number, driver: DriverPositionData): string {
    return `${driver.driverNumber}-${driver.position}`;
  }

  hasPositionChanged(driver: DriverPositionData): boolean {
    const previousPosition = this.previousPositions.get(driver.driverNumber);
    return previousPosition !== undefined && previousPosition !== driver.position;
  }

  getPositionChange(driver: DriverPositionData): number | null {
    const previousPosition = this.previousPositions.get(driver.driverNumber);
    if (previousPosition === undefined) return null;
    return previousPosition - driver.position; // Positive = moved up, negative = moved down
  }

  getChangeTitle(change: number): string {
    const absChange = Math.abs(change);
    const direction = change > 0 ? 'up' : 'down';
    return `Moved ${direction} ${absChange} position${absChange > 1 ? 's' : ''}`;
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }
}
