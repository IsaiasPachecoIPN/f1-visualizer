import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, shareReplay, tap, distinctUntilChanged } from 'rxjs/operators';
import { Openf1ApiService } from './openf1-api.service';
import { AnimationControlService } from './animation-control.service';

export interface PositionSnapshot {
  time: Date;
  positions: DriverPositionData[];
}

export interface DriverPositionData {
  driverNumber: number;
  position: number;
  date: string;
  driverName?: string;
  driverAcronym?: string;
  teamColor?: string;
  teamName?: string;
  carData?: DriverCarData;
}

export interface DriverCarData {
  brake: number;
  drs: number;
  n_gear: number;
  rpm: number;
  speed: number;
  throttle: number;
  date: string;
}

export interface RacePositionsTable {
  drivers: DriverPositionData[];
  lastUpdate: Date;
  totalDrivers: number;
}

@Injectable({
  providedIn: 'root'
})
export class PositionService {
  private positionDataCache: DriverPositionData[] = [];
  private driversCache: any[] = [];
  private racePositionsTable: Map<number, DriverPositionData> = new Map(); // driver_number -> position data
  private currentPositionsSubject = new BehaviorSubject<DriverPositionData[]>([]);
  private initialPositionsSubject = new BehaviorSubject<DriverPositionData[]>([]);
  private raceTableSubject = new BehaviorSubject<RacePositionsTable>({ drivers: [], lastUpdate: new Date(), totalDrivers: 0 });

  // Public observables
  currentPositions$ = this.currentPositionsSubject.asObservable();
  initialPositions$ = this.initialPositionsSubject.asObservable();
  raceTable$ = this.raceTableSubject.asObservable();

  constructor(
    private openf1ApiService: Openf1ApiService,
    private animationControlService: AnimationControlService
  ) {
    this.initializePositionTracking();
  }

  private initializePositionTracking(): void {
    // Load data when session changes
    this.animationControlService.sessionChanged$.subscribe(() => {
      this.loadPositionData();
    });

    // Update current positions based on simulation time
    combineLatest([
      this.animationControlService.currentTime$,
      this.animationControlService.isPlaying$
    ]).pipe(
      distinctUntilChanged(([prevTime, prevPlaying], [currTime, currPlaying]) => {
        if (!prevTime || !currTime) return false;
        // Update more frequently (every 1 second) for real-time car data updates
        return Math.abs(prevTime.getTime() - currTime.getTime()) < 1000 && prevPlaying === currPlaying;
      })
    ).subscribe(([currentTime]) => {
      if (currentTime) {
        this.updateCurrentPositions(currentTime);
        this.updateRaceTable(currentTime);
      }
    });

    // Clear positions when simulation stops
    this.animationControlService.stop$.subscribe(() => {
      this.currentPositionsSubject.next([]);
      // Reset race table to initial positions when stopping
      this.resetRaceTableToInitial();
    });
  }

  private async loadPositionData(): Promise<void> {
    try {
      console.log('🏁 Loading position data for race tracking...');
      
      const [positionData, drivers] = await Promise.all([
        this.openf1ApiService.getPositionData().toPromise(),
        this.openf1ApiService.getDrivers().toPromise()
      ]);

      // Also load car data for enhanced position information
      this.openf1ApiService.getAllDriversCarData().subscribe({
        next: (carData) => {
          console.log(`🚗 Loaded ${carData.length} car data records for enhanced position tracking`);
        },
        error: (error) => {
          console.warn('⚠️ Could not load car data:', error);
        }
      });

      this.positionDataCache = (positionData || [])
        .map(pos => ({
          ...pos,
          driverNumber: pos.driver_number,
          position: pos.position,
          date: pos.date
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      this.driversCache = drivers || [];

      console.log(`🏁 Loaded ${this.positionDataCache.length} position records`);
      console.log(`👥 Loaded ${this.driversCache.length} drivers`);

      // Set initial positions (first available positions)
      this.setInitialPositions();
      this.initializeRaceTable();

    } catch (error) {
      console.error('❌ Error loading position data:', error);
    }
  }

  private setInitialPositions(): void {
    if (this.positionDataCache.length === 0) return;

    // Find the earliest complete set of positions
    const earliestPositions = this.positionDataCache
      .slice(0, 60) // Look at first 60 records to find complete grid
      .reduce((acc: Map<number, DriverPositionData>, pos) => {
        if (!acc.has(pos.driverNumber)) {
          acc.set(pos.driverNumber, this.enrichPositionData(pos));
        }
        return acc;
      }, new Map());

    const initialPositions = Array.from(earliestPositions.values())
      .sort((a, b) => a.position - b.position);

    console.log(`🏁 Set initial grid positions: ${initialPositions.length} drivers`);
    this.initialPositionsSubject.next(initialPositions);
  }

  private updateCurrentPositions(currentTime: Date): void {
    if (this.positionDataCache.length === 0) return;

    console.log(`🏁 updateCurrentPositions called for time: ${currentTime.toISOString()}`);
    
    const currentTimestamp = currentTime.getTime();
    const timeWindow = 30000; // 30 seconds window

    // Find positions closest to current time
    const relevantPositions = this.positionDataCache.filter(pos => {
      const posTime = new Date(pos.date).getTime();
      return Math.abs(posTime - currentTimestamp) <= timeWindow;
    });

    if (relevantPositions.length === 0) {
      // Use the most recent positions before current time
      const beforePositions = this.positionDataCache.filter(pos => {
        const posTime = new Date(pos.date).getTime();
        return posTime <= currentTimestamp;
      });

      if (beforePositions.length > 0) {
        const recentPositions = beforePositions
          .slice(-30) // Take last 30 records
          .reduce((acc: Map<number, DriverPositionData>, pos) => {
            // Pass current simulation time for real-time car data
            acc.set(pos.driverNumber, this.enrichPositionData(pos, currentTime));
            return acc;
          }, new Map());

        const currentPositions = Array.from(recentPositions.values())
          .sort((a, b) => a.position - b.position);

        this.currentPositionsSubject.next(currentPositions);
      }
      return;
    }

    // Group by driver and take most recent position for each
    const driverPositions = relevantPositions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .reduce((acc: Map<number, DriverPositionData>, pos) => {
        if (!acc.has(pos.driverNumber)) {
          // Pass current simulation time for real-time car data
          acc.set(pos.driverNumber, this.enrichPositionData(pos, currentTime));
        }
        return acc;
      }, new Map());

    const currentPositions = Array.from(driverPositions.values())
      .sort((a, b) => a.position - b.position);

    this.currentPositionsSubject.next(currentPositions);
  }

  private enrichPositionData(position: DriverPositionData, currentSimulationTime?: Date): DriverPositionData {
    const driver = this.driversCache.find(d => d.driver_number === position.driverNumber);
    
    // Get car data for this driver at the current simulation time (for real-time updates) 
    // or at the position time (for historical data)
    const timeForCarData = currentSimulationTime || new Date(position.date);
    const carData = this.openf1ApiService.getDriverCarDataAtTime(
      position.driverNumber, 
      timeForCarData, 
      5000 // 5 second window
    );
    
    // Debug log car data updates when using current simulation time
    if (currentSimulationTime && carData) {
      console.log(`🚗 Real-time car data for Driver ${position.driverNumber}: Speed=${carData.speed} km/h, Gear=${carData.n_gear}, RPM=${carData.rpm}`);
    }
    
    return {
      ...position,
      driverName: driver ? `${driver.first_name} ${driver.last_name}` : `Driver ${position.driverNumber}`,
      driverAcronym: driver?.name_acronym || driver?.broadcast_name || `#${position.driverNumber}`,
      teamColor: driver?.car_color || '#888888',
      teamName: driver?.team_name || 'Unknown',
      carData: carData ? {
        brake: carData.brake || 0,
        drs: carData.drs || 0,
        n_gear: carData.n_gear || 0,
        rpm: carData.rpm || 0,
        speed: carData.speed || 0,
        throttle: carData.throttle || 0,
        date: carData.date
      } : undefined
    };
  }

  /**
   * Initialize the race table with all drivers and their starting positions
   */
  private initializeRaceTable(): void {
    if (this.driversCache.length === 0) return;

    console.log('🏁 Initializing complete race positions table...');
    
    // Create initial positions for all drivers
    this.driversCache.forEach((driver, index) => {
      // Look for the driver's first position in the data, or use grid order
      let initialPosition = index + 1;
      const firstPositionData = this.positionDataCache.find(pos => pos.driverNumber === driver.driver_number);
      
      if (firstPositionData) {
        initialPosition = firstPositionData.position;
      }

      const driverPosition: DriverPositionData = {
        driverNumber: driver.driver_number,
        position: initialPosition,
        date: this.positionDataCache[0]?.date || new Date().toISOString(),
        driverName: `${driver.first_name} ${driver.last_name}`,
        driverAcronym: driver.name_acronym || driver.broadcast_name || `#${driver.driver_number}`,
        teamColor: driver.car_color || '#888888',
        teamName: driver.team_name || 'Unknown'
      };

      this.racePositionsTable.set(driver.driver_number, driverPosition);
    });

    // Sort positions and ensure they're sequential
    this.normalizePositions();
    this.emitRaceTable();
    
    console.log(`🏁 Race table initialized with ${this.racePositionsTable.size} drivers`);
  }

  /**
   * Update the race table with current position data
   */
  private updateRaceTable(currentTime: Date): void {
    if (this.racePositionsTable.size === 0) return;

    const currentTimestamp = currentTime.getTime();
    const timeWindow = 30000; // 30 seconds window

    // Find the most recent position updates for each driver
    const recentUpdates = new Map<number, DriverPositionData>();
    
    // Get positions from the time window
    this.positionDataCache
      .filter(pos => {
        const posTime = new Date(pos.date).getTime();
        return Math.abs(posTime - currentTimestamp) <= timeWindow;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Most recent first
      .forEach(pos => {
        if (!recentUpdates.has(pos.driverNumber)) {
          recentUpdates.set(pos.driverNumber, pos);
        }
      });

    // If no recent updates, try to get the most recent positions before current time
    if (recentUpdates.size === 0) {
      const beforePositions = this.positionDataCache
        .filter(pos => new Date(pos.date).getTime() <= currentTimestamp)
        .slice(-50); // Take last 50 records for performance

      const latestByDriver = new Map<number, DriverPositionData>();
      beforePositions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .forEach(pos => {
          if (!latestByDriver.has(pos.driverNumber)) {
            latestByDriver.set(pos.driverNumber, pos);
          }
        });

      latestByDriver.forEach((pos, driverNumber) => {
        recentUpdates.set(driverNumber, pos);
      });
    }

    // Update positions and car data in the race table
    let hasUpdates = false;
    
    // First, update drivers with recent position changes
    recentUpdates.forEach((positionUpdate, driverNumber) => {
      const currentDriverData = this.racePositionsTable.get(driverNumber);
      if (currentDriverData && currentDriverData.position !== positionUpdate.position) {
        // Pass current simulation time to get real-time car data
        const updatedData = this.enrichPositionData(positionUpdate, currentTime);
        this.racePositionsTable.set(driverNumber, updatedData);
        hasUpdates = true;
      }
    });
    
    // Then, update car data for ALL drivers in the race table with current simulation time
    // This ensures car data (speed, gear, etc.) updates continuously even without position changes
    this.racePositionsTable.forEach((driverData, driverNumber) => {
      const updatedData = this.enrichPositionData(driverData, currentTime);
      this.racePositionsTable.set(driverNumber, updatedData);
    });
    
    // Always emit the race table since car data should update continuously
    this.normalizePositions();
    this.emitRaceTable();
  }

  /**
   * Ensure all positions are sequential and no duplicates exist
   */
  private normalizePositions(): void {
    const drivers = Array.from(this.racePositionsTable.values())
      .sort((a, b) => a.position - b.position);

    // Fix any position gaps or duplicates
    drivers.forEach((driver, index) => {
      const correctPosition = index + 1;
      if (driver.position !== correctPosition) {
        const updatedDriver = { ...driver, position: correctPosition };
        this.racePositionsTable.set(driver.driverNumber, updatedDriver);
      }
    });
  }

  /**
   * Reset race table to initial positions
   */
  private resetRaceTableToInitial(): void {
    if (this.initialPositionsSubject.value.length > 0) {
      this.initialPositionsSubject.value.forEach(initial => {
        this.racePositionsTable.set(initial.driverNumber, { ...initial });
      });
      this.emitRaceTable();
    }
  }

  /**
   * Emit the current race table state
   */
  private emitRaceTable(): void {
    const drivers = Array.from(this.racePositionsTable.values())
      .sort((a, b) => a.position - b.position);

    const raceTable: RacePositionsTable = {
      drivers,
      lastUpdate: new Date(),
      totalDrivers: drivers.length
    };

    this.raceTableSubject.next(raceTable);
  }

  // Public methods for components to use
  getPositionsAtTime(time: Date): DriverPositionData[] {
    const timestamp = time.getTime();
    const timeWindow = 30000; // 30 seconds

    const relevantPositions = this.positionDataCache.filter(pos => {
      const posTime = new Date(pos.date).getTime();
      return Math.abs(posTime - timestamp) <= timeWindow;
    });

    if (relevantPositions.length === 0) return [];

    // Group by driver and take most recent
    const driverPositions = relevantPositions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .reduce((acc: Map<number, DriverPositionData>, pos) => {
        if (!acc.has(pos.driverNumber)) {
          // Use the provided time for car data to get appropriate historical or real-time data
          acc.set(pos.driverNumber, this.enrichPositionData(pos, time));
        }
        return acc;
      }, new Map());

    return Array.from(driverPositions.values())
      .sort((a, b) => a.position - b.position);
  }

  getPositionChanges(fromTime: Date, toTime: Date): { driver: DriverPositionData, oldPosition: number, newPosition: number }[] {
    const fromPositions = this.getPositionsAtTime(fromTime);
    const toPositions = this.getPositionsAtTime(toTime);

    const changes: { driver: DriverPositionData, oldPosition: number, newPosition: number }[] = [];

    toPositions.forEach(currentPos => {
      const previousPos = fromPositions.find(p => p.driverNumber === currentPos.driverNumber);
      if (previousPos && previousPos.position !== currentPos.position) {
        changes.push({
          driver: currentPos,
          oldPosition: previousPos.position,
          newPosition: currentPos.position
        });
      }
    });

    return changes;
  }

  getCurrentPositions(): DriverPositionData[] {
    return this.currentPositionsSubject.value;
  }

  getInitialPositions(): DriverPositionData[] {
    return this.initialPositionsSubject.value;
  }

  /**
   * Get the current race table with all drivers and their positions
   */
  getRaceTable(): RacePositionsTable {
    return this.raceTableSubject.value;
  }

  /**
   * Get a specific driver's current position from the race table
   */
  getDriverPosition(driverNumber: number): DriverPositionData | undefined {
    return this.racePositionsTable.get(driverNumber);
  }

  // Method to manually trigger position data reload
  reloadPositionData(): void {
    this.loadPositionData();
  }
}
