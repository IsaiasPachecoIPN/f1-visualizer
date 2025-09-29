import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, combineLatest, BehaviorSubject, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { AnimationControlService } from '../../services/animation-control.service';
import { Openf1ApiService } from '../../services/openf1-api.service';

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
        <span class="sync-note" title="Positions may have slight delay due to data synchronization">ⓘ</span>
      </h3>
      
      <div class="positions-list" *ngIf="positions$ | async as positions">
        <div *ngIf="positions.length === 0" class="no-positions">
          Position data will appear during simulation...
        </div>
        
        <div *ngFor="let driver of positions; let i = index; trackBy: trackByPosition" 
             class="position-item"
             [class.podium]="driver.position <= 3">
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
    }

    .sync-note {
      font-size: 12px;
      color: #999;
      cursor: help;
      opacity: 0.7;
    }

    .sync-note:hover {
      opacity: 1;
      color: #ff6b35;
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
    }

    .position-item:hover {
      background: #333;
      transform: translateX(2px);
    }

    .position-item.podium {
      border-left-color: #ffd700;
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
  `]
})
export class PositionsComponent implements OnInit, OnDestroy {
  positions$: Observable<DriverPosition[]>;
  private positionsSubject = new BehaviorSubject<DriverPosition[]>([]);
  private subscriptions: Subscription[] = [];

  constructor(
    private animationControlService: AnimationControlService,
    private openf1ApiService: Openf1ApiService
  ) {
    this.positions$ = this.positionsSubject.asObservable();
  }

  ngOnInit(): void {
    // Subscribe to position updates
    const positionSub = this.createPositionsObservable().subscribe(positions => {
      this.positionsSubject.next(positions);
    });
    this.subscriptions.push(positionSub);

    // Clear positions when simulation stops/restarts
    const stopSub = this.animationControlService.stop$.subscribe(() => {
      console.log('🧹 Clearing race positions');
      this.positionsSubject.next([]);
    });
    this.subscriptions.push(stopSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private createPositionsObservable(): Observable<DriverPosition[]> {
    return combineLatest([
      this.animationControlService.currentTime$,
      this.openf1ApiService.getDrivers(),
      this.openf1ApiService.getPositionData()
    ]).pipe(
      map(([currentTime, drivers, positionData]) => {
        console.log('📊 Positions data check:', {
          currentTime: currentTime?.toISOString(),
          driversCount: drivers?.length,
          positionDataCount: positionData?.length
        });

        if (!currentTime || !drivers || !positionData) {
          console.log('❌ Missing data for positions');
          return [];
        }

        // Find position data closest to current time with improved synchronization
        const currentTimestamp = currentTime.getTime();
        const timeWindow = 60000; // Increased to 60 seconds window for better matching

        // Filter position data within time window
        const relevantPositions = positionData.filter(pos => {
          const posTime = new Date(pos.date).getTime();
          const timeDiff = Math.abs(posTime - currentTimestamp);
          return timeDiff <= timeWindow;
        });

        console.log(`📍 Found ${relevantPositions.length} relevant positions for time ${currentTime.toISOString()}`);

        if (relevantPositions.length === 0) {
          // If no exact match, try to find the closest positions before current time
          const beforePositions = positionData.filter(pos => {
            const posTime = new Date(pos.date).getTime();
            return posTime <= currentTimestamp;
          });
          
          if (beforePositions.length > 0) {
            // Sort by time and take the most recent 20 entries
            const sortedPositions = beforePositions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 20);
            
            console.log(`📍 Using ${sortedPositions.length} closest previous positions`);
            return this.processPositionData(sortedPositions, drivers);
          }
          
          return [];
        }

        return this.processPositionData(relevantPositions, drivers);
      })
    );
  }

  private processPositionData(relevantPositions: any[], drivers: any[]): DriverPosition[] {
    // Get the most recent position data for better accuracy
    const latestPositions = relevantPositions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20); // Take latest 20 entries to get all drivers

    // Group by driver and take the most recent position for each
    const driverPositions = new Map<number, any>();
    latestPositions.forEach(pos => {
      if (!driverPositions.has(pos.driver_number)) {
        driverPositions.set(pos.driver_number, pos);
      }
    });

    // Convert to DriverPosition array and add driver details
    const positions: DriverPosition[] = Array.from(driverPositions.values())
      .map(pos => {
        const driver = drivers.find(d => d.driver_number === pos.driver_number);
        if (!driver) return null;

        return {
          position: pos.position,
          driverNumber: pos.driver_number,
          driverName: `${driver.first_name} ${driver.last_name}`,
          driverAcronym: driver.name_acronym || driver.broadcast_name || `#${pos.driver_number}`,
          teamColor: driver.car_color || '#888888',
          teamName: driver.team_name || 'Unknown'
        };
      })
      .filter(pos => pos !== null)
      .sort((a, b) => a!.position - b!.position)
      .slice(0, 10) as DriverPosition[]; // Show top 10

    return positions;
  }

  getPositionClass(position: number): string {
    switch (position) {
      case 1: return 'p1';
      case 2: return 'p2';
      case 3: return 'p3';
      default: return '';
    }
  }

  trackByPosition(index: number, driver: DriverPosition): string {
    return `${driver.driverNumber}-${driver.position}`;
  }
}
