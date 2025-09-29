import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { AnimationControlService } from './animation-control.service';
import { Openf1ApiService } from './openf1-api.service';

export interface RaceComment {
  id: string;
  time: Date;
  timeString: string;
  text: string;
  type: 'overtake' | 'position' | 'info';
  driverNumbers?: number[];
}

@Injectable({
  providedIn: 'root'
})
export class RaceCommentaryService {
  private positionData: any[] = [];
  private drivers: any[] = [];
  private previousPositions: Map<number, number> = new Map();
  private commentsSubject = new BehaviorSubject<RaceComment[]>([]);
  private allComments: RaceComment[] = [];

  comments$ = this.commentsSubject.asObservable();

  constructor(
    private animationControlService: AnimationControlService,
    private openf1ApiService: Openf1ApiService
  ) {
    this.initializeCommentary();
  }

  // Public method to trigger data loading
  loadData(): void {
    this.loadRaceData();
  }

  private initializeCommentary(): void {
    // Load position data and drivers when session changes
    this.animationControlService.sessionChanged$.subscribe(() => {
      this.loadRaceData();
    });

    // Clear comments when simulation stops/restarts
    this.animationControlService.stop$.subscribe(() => {
      this.clearComments();
    });

    // Monitor current time to generate live comments
    this.animationControlService.currentTime$.pipe(
      distinctUntilChanged((prev, curr) => {
        if (!prev || !curr) return false;
        // Only check every 5 seconds to avoid too frequent updates
        return Math.abs(prev.getTime() - curr.getTime()) < 5000;
      })
    ).subscribe(currentTime => {
      if (currentTime) {
        this.generateCommentsForTime(currentTime);
      }
    });
  }

  private async loadRaceData(): Promise<void> {
    try {
      // Load drivers and position data (use position endpoint for race commentary)
      const [drivers, positions] = await Promise.all([
        firstValueFrom(this.openf1ApiService.getDrivers()),
        firstValueFrom(this.openf1ApiService.getPositionData())
      ]);

      this.drivers = drivers || [];
      this.positionData = (positions || []).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Reset comments and previous positions
      this.allComments = [];
      this.previousPositions.clear();
      this.commentsSubject.next([]);

      console.log(`💬 Loaded ${this.positionData.length} position records for commentary`);
      console.log(`👥 Loaded ${this.drivers.length} drivers for commentary`);
    } catch (error) {
      console.error('Error loading race data for commentary:', error);
    }
  }

  private generateCommentsForTime(currentTime: Date): void {
    if (this.positionData.length === 0) return;

    const currentTimestamp = currentTime.getTime();
    
    // Find position data around current time (increased tolerance to 60 seconds)
    const relevantPositions = this.positionData.filter(pos => {
      const posTime = new Date(pos.date).getTime();
      return Math.abs(posTime - currentTimestamp) <= 60000; // Increased from 30 to 60 seconds
    });

    if (relevantPositions.length === 0) {
      // If no positions found within window, look for closest previous positions
      const beforePositions = this.positionData.filter(pos => {
        const posTime = new Date(pos.date).getTime();
        return posTime <= currentTimestamp;
      });
      
      if (beforePositions.length > 0) {
        const closestPositions = beforePositions
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 20);
        
        console.log(`💬 Using ${closestPositions.length} closest previous positions for commentary`);
        this.analyzePositionsArray(currentTime, closestPositions);
      }
      return;
    }

    console.log(`💬 Found ${relevantPositions.length} relevant positions for commentary at ${currentTime.toISOString()}`);

    // Group by timestamp to get position snapshots
    const positionSnapshots = new Map<string, any[]>();
    relevantPositions.forEach(pos => {
      const timeKey = pos.date;
      if (!positionSnapshots.has(timeKey)) {
        positionSnapshots.set(timeKey, []);
      }
      positionSnapshots.get(timeKey)!.push(pos);
    });

    // Analyze each snapshot for overtakes
    Array.from(positionSnapshots.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .forEach(([timeKey, positions]) => {
        this.analyzePositionSnapshot(new Date(timeKey), positions);
      });
  }

  private analyzePositionsArray(time: Date, positions: any[]): void {
    // Sort positions by position number
    const sortedPositions = positions.sort((a, b) => a.position - b.position);
    this.analyzePositionSnapshot(time, sortedPositions);
  }

  private analyzePositionSnapshot(time: Date, positions: any[]): void {
    // Sort positions by position number
    const sortedPositions = positions.sort((a, b) => a.position - b.position);

    // Check each position for changes
    sortedPositions.forEach(pos => {
      const driverNumber = pos.driver_number;
      const currentPosition = pos.position;
      const previousPosition = this.previousPositions.get(driverNumber);

      if (previousPosition !== undefined && previousPosition !== currentPosition) {
        // Position changed - generate comment
        this.generateOvertakeComment(time, driverNumber, previousPosition, currentPosition);
      }

      // Update previous position
      this.previousPositions.set(driverNumber, currentPosition);
    });
  }

  private generateOvertakeComment(time: Date, driverNumber: number, oldPos: number, newPos: number): void {
    const driver = this.drivers.find(d => d.driver_number === driverNumber);
    if (!driver) return;

    // Check if we already have a comment for this time and driver
    const timeString = this.formatTime(time);
    const existingComment = this.allComments.find(c =>
      c.timeString === timeString &&
      c.driverNumbers?.includes(driverNumber)
    );

    if (existingComment) return;

    let commentText = '';
    let commentType: 'overtake' | 'position' | 'info' = 'position';

    if (newPos < oldPos) {
      // Driver moved up
      const positionsGained = oldPos - newPos;
      if (positionsGained === 1) {
        commentText = `${driver.name_acronym} overtakes into P${newPos}!`;
      } else {
        commentText = `${driver.name_acronym} gains ${positionsGained} positions, now P${newPos}!`;
      }
      commentType = 'overtake';
    } else if (newPos > oldPos) {
      // Driver moved down
      const positionsLost = newPos - oldPos;
      if (positionsLost === 1) {
        commentText = `${driver.name_acronym} drops to P${newPos}`;
      } else {
        commentText = `${driver.name_acronym} falls ${positionsLost} positions to P${newPos}`;
      }
      commentType = 'position';
    }

    if (commentText) {
      const comment: RaceComment = {
        id: `${time.getTime()}-${driverNumber}-${oldPos}-${newPos}`,
        time,
        timeString,
        text: commentText,
        type: commentType,
        driverNumbers: [driverNumber]
      };

      this.allComments.push(comment);
      
      // Keep only the latest 50 comments and sort by time (newest first)
      this.allComments.sort((a, b) => b.time.getTime() - a.time.getTime());
      if (this.allComments.length > 50) {
        this.allComments = this.allComments.slice(0, 50);
      }

      this.commentsSubject.next([...this.allComments]);
    }
  }

  private formatTime(time: Date): string {
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  // Method to add custom comments (for future use)
  addCustomComment(text: string, type: 'info' | 'overtake' | 'position' = 'info'): void {
    const currentTime = this.animationControlService.getCurrentTime();
    if (!currentTime) return;

    const comment: RaceComment = {
      id: `custom-${Date.now()}`,
      time: currentTime,
      timeString: this.formatTime(currentTime),
      text,
      type
    };

    this.allComments.unshift(comment);
    this.commentsSubject.next([...this.allComments]);
  }

  // Clear all comments
  clearComments(): void {
    this.allComments = [];
    this.commentsSubject.next([]);
  }
}
