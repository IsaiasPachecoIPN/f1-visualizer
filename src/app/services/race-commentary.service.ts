import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { AnimationControlService } from './animation-control.service';
import { PositionService, DriverPositionData } from './position.service';

/**
 * Race Commentary Service
 * 
 * This service automatically generates race commentary based on real-time position data 
 * from the OpenF1 API. It integrates with the PositionService to:
 * 
 * 1. Track position changes throughout the race
 * 2. Generate overtaking comments
 * 3. Identify position battles and swaps
 * 4. Provide leadership and podium updates
 * 5. Generate race statistics and summaries
 * 
 * The service uses the getPositionData() method from OpenF1 API via PositionService
 * to receive real-time driver positions and automatically generates contextual 
 * race commentary.
 * 
 * Key Features:
 * - Automatic position change detection
 * - Battle and overtake commentary
 * - Podium position tracking
 * - Race statistics and insights
 * - Time-based commentary filtering to avoid spam
 */

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
  private previousPositions: Map<number, number> = new Map();
  private commentsSubject = new BehaviorSubject<RaceComment[]>([]);
  private allComments: RaceComment[] = [];
  private lastProcessedTime: Date | null = null;
  private currentCompleteStandings: DriverPositionData[] = [];
  private lastPositionUpdateTime: Date | null = null;
  
  // Master driver registry - always maintains complete driver list
  private masterDriverRegistry: Map<number, DriverPositionData> = new Map();
  private isDriverRegistryInitialized: boolean = false;
  
  private completeStandingsSubject = new BehaviorSubject<DriverPositionData[]>([]);

  comments$ = this.commentsSubject.asObservable();
  completeStandings$ = this.completeStandingsSubject.asObservable(); // Observable for complete standings

  constructor(
    private animationControlService: AnimationControlService,
    private positionService: PositionService
  ) {
    console.log('💬 RaceCommentaryService initialized - ready to generate commentary from position data');
    this.initializeCommentary();
  }

  // Public method to trigger data loading
  loadData(): void {
    console.log('💬 Loading race commentary data and triggering position service...');
    this.loadRaceData();
    // Also trigger position service to load data
    this.positionService.reloadPositionData();
    
    // Add a welcome message
    setTimeout(() => {
      this.addCustomComment('🏁 Race commentary system activated - tracking position changes!', 'info');
      
      // Refresh complete standings after data loads
      setTimeout(() => {
        this.refreshCompleteStandings();
      }, 2000);
    }, 1000);
  }

  private initializeCommentary(): void {
    // Clear comments when session changes
    this.animationControlService.sessionChanged$.subscribe(() => {
      this.clearComments();
      this.previousPositions.clear();
      this.lastProcessedTime = null;
      this.currentCompleteStandings = [];
      this.lastPositionUpdateTime = null;
      this.masterDriverRegistry.clear(); // Clear master driver registry on session change
      this.isDriverRegistryInitialized = false;
      console.log('💬 Session changed - cleared all standings and commentary data');
    });

    // Clear comments when simulation stops/restarts
    this.animationControlService.stop$.subscribe(() => {
      this.clearComments();
      this.previousPositions.clear();
      this.lastProcessedTime = null;
      // Keep master driver registry and just reset processing times
      console.log('💬 Simulation stopped - reset commentary tracking');
    });

    // Monitor current positions to generate live comments
    this.positionService.currentPositions$.pipe(
      distinctUntilChanged((prev, curr) => {
        if (!prev || !curr) return false;
        // Check if positions have meaningfully changed
        return prev.length === curr.length && 
               prev.every((p, i) => p.driverNumber === curr[i]?.driverNumber && p.position === curr[i]?.position);
      })
    ).subscribe(positions => {
      if (positions.length > 0) {
        this.analyzePositionChanges(positions);
      }
    });

    // Add initial grid comment when initial positions are set
    this.positionService.initialPositions$.subscribe(initialPositions => {
      if (initialPositions.length > 0) {
        this.addInitialGridComment(initialPositions);
      }
    });
  }

  private addInitialGridComment(initialPositions: DriverPositionData[]): void {
    if (this.allComments.length > 0) return; // Don't add multiple initial comments

    // Initialize the master driver registry with initial grid
    this.initializeMasterDriverRegistry(initialPositions);

    const topDrivers = initialPositions.slice(0, 3);
    const commentText = `Starting grid: ${topDrivers.map(d => `P${d.position} ${d.driverAcronym}`).join(', ')} (+${initialPositions.length - 3} more drivers)`;
    
    this.addCustomComment(commentText, 'info');
    
    console.log(`🏁 Added initial grid comment with ${initialPositions.length} drivers and initialized master driver registry`);
  }

  private initializeMasterDriverRegistry(initialPositions: DriverPositionData[]): void {
    if (this.isDriverRegistryInitialized) return;

    console.log('🏁 Initializing master driver registry...');
    
    // Populate master registry with all drivers
    initialPositions.forEach(pos => {
      this.masterDriverRegistry.set(pos.driverNumber, { ...pos });
      this.previousPositions.set(pos.driverNumber, pos.position);
    });

    this.isDriverRegistryInitialized = true;
    this.currentCompleteStandings = [...initialPositions].sort((a, b) => a.position - b.position);
    this.completeStandingsSubject.next([...this.currentCompleteStandings]);

    console.log(`🏁 Master driver registry initialized with ${this.masterDriverRegistry.size} drivers`);
  }

  private analyzePositionChanges(currentPositions: DriverPositionData[]): void {
    const now = this.animationControlService.getCurrentTime();
    if (!now) return;

    // Update global standings
    this.updateGlobalStandings(currentPositions, now);

    // Avoid processing the same time multiple times
    if (this.lastProcessedTime && Math.abs(now.getTime() - this.lastProcessedTime.getTime()) < 5000) {
      return; // Skip if less than 5 seconds since last processing
    }

    this.lastProcessedTime = now;

    // Track all position changes in this update
    const positionChanges: Array<{
      driver: DriverPositionData;
      oldPosition: number;
      newPosition: number;
      positionChange: number;
    }> = [];

    // Check each position for changes
    currentPositions.forEach(pos => {
      const driverNumber = pos.driverNumber;
      const currentPosition = pos.position;
      const previousPosition = this.previousPositions.get(driverNumber);

      if (previousPosition !== undefined && previousPosition !== currentPosition) {
        positionChanges.push({
          driver: pos,
          oldPosition: previousPosition,
          newPosition: currentPosition,
          positionChange: Math.abs(currentPosition - previousPosition)
        });
      }

      // Update previous position
      this.previousPositions.set(driverNumber, currentPosition);
    });

    // Generate comments for position changes
    if (positionChanges.length > 0) {
      this.generatePositionChangeComments(now, positionChanges, currentPositions);
    }

    // Generate position-based insights
    this.generatePositionInsights(now, currentPositions);
  }

  private updateGlobalStandings(currentPositions: DriverPositionData[], updateTime: Date): void {
    // Ensure master registry is initialized
    if (!this.isDriverRegistryInitialized && currentPositions.length > 0) {
      this.initializeMasterDriverRegistry(currentPositions);
    }

    // Update positions for drivers that have current data
    currentPositions.forEach(pos => {
      if (this.masterDriverRegistry.has(pos.driverNumber)) {
        // Update existing driver with new position data
        const existingDriver = this.masterDriverRegistry.get(pos.driverNumber)!;
        this.masterDriverRegistry.set(pos.driverNumber, {
          ...existingDriver,
          position: pos.position,
          date: pos.date
        });
      } else {
        // New driver discovered - add to registry
        this.masterDriverRegistry.set(pos.driverNumber, { ...pos });
        console.log(`🆕 New driver added to registry: ${pos.driverAcronym} (#${pos.driverNumber})`);
      }
    });

    // Build complete standings from master registry
    const completeStandings = this.buildCompleteStandingsFromRegistry();
    
    // Update our internal complete standings
    this.currentCompleteStandings = completeStandings;
    this.lastPositionUpdateTime = updateTime;

    // Emit the complete standings for components to use
    this.completeStandingsSubject.next([...completeStandings]);

    // Log complete standings periodically for debugging
    if (!this.lastProcessedTime || Math.abs(updateTime.getTime() - this.lastProcessedTime.getTime()) >= 10000) {
      console.log('🏁 Complete Race Standings Update:', 
        completeStandings.map(p => `P${p.position}: ${p.driverAcronym}`).join(', ')
      );
    }

    // Generate periodic complete standings comments
    this.generateCompleteStandingsComment(updateTime, completeStandings);
  }

  private buildCompleteStandingsFromRegistry(): DriverPositionData[] {
    // Get all drivers from the master registry
    const allDrivers = Array.from(this.masterDriverRegistry.values());
    
    // Sort by current position
    return allDrivers
      .sort((a, b) => a.position - b.position)
      .map((driver, index) => ({
        ...driver,
        position: index + 1 // Ensure sequential positions starting from 1
      }));
  }

  private generateCompleteStandingsComment(time: Date, standings: DriverPositionData[]): void {
    // Generate complete standings comment every 60 seconds
    const lastStandingsComment = this.allComments.find(c => c.text.includes('Complete standings:'));
    
    if (!lastStandingsComment || 
        Math.abs(time.getTime() - lastStandingsComment.time.getTime()) > 60000) {
      
      const top10 = standings.slice(0, 10);
      const standingsText = top10.map(p => `P${p.position} ${p.driverAcronym}`).join(', ');
      const remainingCount = standings.length - 10;
      
      let commentText = `📊 Complete standings: ${standingsText}`;
      if (remainingCount > 0) {
        commentText += ` (+${remainingCount} more)`;
      }

      const comment: RaceComment = {
        id: `standings-${time.getTime()}`,
        time,
        timeString: this.formatTime(time),
        text: commentText,
        type: 'info',
        driverNumbers: top10.map(p => p.driverNumber)
      };

      this.allComments.unshift(comment);
      console.log('📊 Generated complete standings comment');
    }
  }

  private generateOvertakeComment(time: Date, driverData: DriverPositionData, oldPos: number, newPos: number): void {
    const direction = newPos < oldPos ? 'gained' : 'lost';
    const positionChange = Math.abs(newPos - oldPos);
    const positionText = positionChange === 1 ? 'position' : 'positions';
    
    let commentText: string;
    if (direction === 'gained') {
      commentText = `${driverData.driverAcronym} moves up to P${newPos}! (${direction} ${positionChange} ${positionText})`;
    } else {
      commentText = `${driverData.driverAcronym} drops to P${newPos} (${direction} ${positionChange} ${positionText})`;
    }

    const comment: RaceComment = {
      id: `${driverData.driverNumber}-${time.getTime()}`,
      time,
      timeString: this.formatTime(time),
      text: commentText,
      type: 'overtake',
      driverNumbers: [driverData.driverNumber]
    };

    this.allComments.unshift(comment);
    this.commentsSubject.next([...this.allComments]);
    
    console.log(`🏎️ Position change: ${commentText}`);
  }

  private generatePositionChangeComments(time: Date, positionChanges: Array<{
    driver: DriverPositionData;
    oldPosition: number;
    newPosition: number;
    positionChange: number;
  }>, allPositions: DriverPositionData[]): void {
    
    // Sort changes by significance (larger position changes first)
    positionChanges.sort((a, b) => b.positionChange - a.positionChange);

    // Generate comments for the most significant changes (limit to avoid spam)
    const maxComments = Math.min(3, positionChanges.length);
    
    for (let i = 0; i < maxComments; i++) {
      const change = positionChanges[i];
      
      // Skip very small changes unless it's a podium position
      if (change.positionChange === 1 && change.newPosition > 3) {
        continue;
      }

      let commentText: string;
      const direction = change.newPosition < change.oldPosition ? 'up' : 'down';
      
      // Get context about total field size
      const totalDrivers = this.currentCompleteStandings.length;
      const positionContext = totalDrivers > 0 ? ` of ${totalDrivers}` : '';
      
      if (change.positionChange > 1) {
        // Multiple position changes - include global context
        commentText = `🔥 ${change.driver.driverAcronym} moves ${direction} ${change.positionChange} positions to P${change.newPosition}${positionContext}!`;
      } else if (change.newPosition <= 3) {
        // Podium position changes
        const positionNames = ['', '1st', '2nd', '3rd'];
        commentText = `🏆 ${change.driver.driverAcronym} ${direction === 'up' ? 'gains' : 'loses'} ${positionNames[change.newPosition]} place${positionContext}!`;
      } else {
        // Single position changes with context
        commentText = `${change.driver.driverAcronym} moves ${direction} to P${change.newPosition}${positionContext}`;
      }

      const comment: RaceComment = {
        id: `change-${change.driver.driverNumber}-${time.getTime()}`,
        time,
        timeString: this.formatTime(time),
        text: commentText,
        type: 'overtake',
        driverNumbers: [change.driver.driverNumber]
      };

      this.allComments.unshift(comment);
    }

    // Generate battle comments for close position fights
    this.generateBattleComments(time, positionChanges, allPositions);

    // Add a mini standings update for significant changes
    if (positionChanges.length >= 2) {
      this.generateMiniStandingsUpdate(time, positionChanges);
    }

    this.commentsSubject.next([...this.allComments]);
  }

  private generateMiniStandingsUpdate(time: Date, positionChanges: Array<{
    driver: DriverPositionData;
    oldPosition: number;
    newPosition: number;
    positionChange: number;
  }>): void {
    // Generate a mini update showing affected positions
    const affectedPositions = new Set<number>();
    positionChanges.forEach(change => {
      affectedPositions.add(change.newPosition);
      affectedPositions.add(change.oldPosition);
    });

    const minPos = Math.min(...affectedPositions);
    const maxPos = Math.max(...affectedPositions);
    
    if (maxPos - minPos <= 5 && affectedPositions.size <= 6) {
      const relevantStandings = this.currentCompleteStandings
        .filter(driver => driver.position >= minPos && driver.position <= maxPos)
        .sort((a, b) => a.position - b.position);

      if (relevantStandings.length > 0) {
        const standingsText = relevantStandings
          .map(p => `P${p.position} ${p.driverAcronym}`)
          .join(', ');

        const comment: RaceComment = {
          id: `mini-standings-${time.getTime()}`,
          time,
          timeString: this.formatTime(time),
          text: `📍 Positions ${minPos}-${maxPos}: ${standingsText}`,
          type: 'position',
          driverNumbers: relevantStandings.map(p => p.driverNumber)
        };

        this.allComments.unshift(comment);
      }
    }
  }

  private generateBattleComments(time: Date, positionChanges: Array<{
    driver: DriverPositionData;
    oldPosition: number;
    newPosition: number;
    positionChange: number;
  }>, allPositions: DriverPositionData[]): void {
    
    // Look for position swaps (two drivers exchanging positions)
    for (let i = 0; i < positionChanges.length; i++) {
      for (let j = i + 1; j < positionChanges.length; j++) {
        const change1 = positionChanges[i];
        const change2 = positionChanges[j];
        
        // Check if they swapped positions
        if (change1.oldPosition === change2.newPosition && 
            change1.newPosition === change2.oldPosition &&
            Math.abs(change1.newPosition - change2.newPosition) === 1) {
          
          const winner = change1.newPosition < change2.newPosition ? change1.driver : change2.driver;
          const loser = change1.newPosition < change2.newPosition ? change2.driver : change1.driver;
          
          const commentText = `⚔️ Battle resolved! ${winner.driverAcronym} overtakes ${loser.driverAcronym} for P${winner.position}`;
          
          const comment: RaceComment = {
            id: `battle-${time.getTime()}`,
            time,
            timeString: this.formatTime(time),
            text: commentText,
            type: 'overtake',
            driverNumbers: [winner.driverNumber, loser.driverNumber]
          };

          this.allComments.unshift(comment);
          break; // Don't generate multiple battle comments for the same time
        }
      }
    }
  }

  private generatePositionInsights(time: Date, currentPositions: DriverPositionData[]): void {
    // Generate insights every 30 seconds to avoid spam
    const timeSinceLastInsight = this.lastProcessedTime ? 
      Math.abs(time.getTime() - this.lastProcessedTime.getTime()) : 0;
    
    if (timeSinceLastInsight < 30000) return; // 30 seconds

    // Generate different types of insights
    this.generateLeadershipInsight(time, currentPositions);
    this.generatePodiumInsight(time, currentPositions);
  }

  private generateLeadershipInsight(time: Date, currentPositions: DriverPositionData[]): void {
    if (currentPositions.length === 0) return;
    
    const leader = currentPositions.find(p => p.position === 1);
    if (!leader) return;

    // Only comment on leadership if it changed recently
    const previousLeader = Array.from(this.previousPositions.entries())
      .find(([_, position]) => position === 1);
    
    if (previousLeader && previousLeader[0] !== leader.driverNumber) {
      const commentText = `👑 New race leader: ${leader.driverAcronym} takes the lead!`;
      
      const comment: RaceComment = {
        id: `leader-${time.getTime()}`,
        time,
        timeString: this.formatTime(time),
        text: commentText,
        type: 'position',
        driverNumbers: [leader.driverNumber]
      };

      this.allComments.unshift(comment);
    }
  }

  private generatePodiumInsight(time: Date, currentPositions: DriverPositionData[]): void {
    const podiumPositions = currentPositions.filter(p => p.position <= 3).sort((a, b) => a.position - b.position);
    
    if (podiumPositions.length >= 3) {
      const commentText = `🏆 Current podium: ${podiumPositions.map(p => `P${p.position} ${p.driverAcronym}`).join(', ')}`;
      
      // Only add this insight occasionally to avoid spam
      const recentPodiumComments = this.allComments.filter(c => 
        c.type === 'position' && c.text.includes('podium')
      );
      
      if (recentPodiumComments.length === 0 || 
          (recentPodiumComments[0] && 
           Math.abs(time.getTime() - recentPodiumComments[0].time.getTime()) > 60000)) {
        
        const comment: RaceComment = {
          id: `podium-${time.getTime()}`,
          time,
          timeString: this.formatTime(time),
          text: commentText,
          type: 'position',
          driverNumbers: podiumPositions.map(p => p.driverNumber)
        };

        this.allComments.unshift(comment);
      }
    }
  }

  private async loadRaceData(): Promise<void> {
    // DISABLED: Using PositionService instead
    console.log('💬 loadRaceData() disabled - using PositionService for position data');
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
    this.currentCompleteStandings = [];
    this.lastPositionUpdateTime = null;
    // Don't clear masterDriverRegistry unless it's a session change
    // The registry should persist to maintain driver continuity
  }

  // Public method to get current complete global standings
  getCurrentGlobalStandings(): DriverPositionData[] {
    return [...this.currentCompleteStandings].sort((a, b) => a.position - b.position);
  }

  // Public method to get all known drivers (even if missing from current positions)
  getAllKnownDrivers(): DriverPositionData[] {
    return Array.from(this.masterDriverRegistry.values())
      .sort((a, b) => (a.position || 99) - (b.position || 99));
  }

  // Public method to force refresh complete standings from position service
  refreshCompleteStandings(): void {
    const currentPositions = this.positionService.getCurrentPositions();
    const initialPositions = this.positionService.getInitialPositions();
    
    // Initialize registry if not done yet
    if (!this.isDriverRegistryInitialized && initialPositions.length > 0) {
      this.initializeMasterDriverRegistry(initialPositions);
    }
    
    // If we have current positions, update the registry
    if (currentPositions.length > 0) {
      this.updateGlobalStandings(currentPositions, new Date());
    } else if (!this.isDriverRegistryInitialized && initialPositions.length > 0) {
      // Fallback to initial positions if no current data
      console.log('💬 No current positions, using initial positions to initialize master registry');
      this.initializeMasterDriverRegistry(initialPositions);
    }
    
    console.log(`💬 Refreshed complete standings: ${this.currentCompleteStandings.length} drivers in registry`);
  }

  // Public method to get master registry status for debugging
  getMasterRegistryStatus(): {
    isInitialized: boolean;
    driverCount: number;
    driverNumbers: number[];
  } {
    return {
      isInitialized: this.isDriverRegistryInitialized,
      driverCount: this.masterDriverRegistry.size,
      driverNumbers: Array.from(this.masterDriverRegistry.keys()).sort((a, b) => a - b)
    };
  }

  // Public method to get standings at specific position range
  getStandingsRange(startPosition: number, endPosition: number): DriverPositionData[] {
    return this.currentCompleteStandings
      .filter(driver => driver.position >= startPosition && driver.position <= endPosition)
      .sort((a, b) => a.position - b.position);
  }

  // Public method to get top N positions
  getTopPositions(count: number = 10): DriverPositionData[] {
    return this.currentCompleteStandings
      .sort((a, b) => a.position - b.position)
      .slice(0, count);
  }

  // Public method to find driver's current position
  getDriverCurrentPosition(driverNumber: number): DriverPositionData | null {
    return this.currentCompleteStandings.find(driver => driver.driverNumber === driverNumber) || null;
  }

  // Public method to get complete standings as formatted string
  getFormattedStandings(maxPositions: number = 20): string {
    const standings = this.getTopPositions(maxPositions);
    return standings.map(p => `P${p.position} ${p.driverAcronym} (${p.teamName})`).join('\n');
  }

  // Public method to force generate complete standings comment
  generateCompleteStandingsNow(): void {
    const currentTime = this.animationControlService.getCurrentTime();
    if (!currentTime || this.currentCompleteStandings.length === 0) {
      console.log('💬 Cannot generate standings: no current time or standings available');
      return;
    }

    console.log('💬 Generating complete standings comment manually...');
    this.generateCompleteStandingsComment(currentTime, this.currentCompleteStandings);
    this.commentsSubject.next([...this.allComments]);
  }

  // Public method to get position-based statistics
  getPositionStatistics(): { 
    totalPositionChanges: number;
    mostActiveDriver: string | null;
    biggestGainer: string | null;
    biggestLoser: string | null;
  } {
    const currentPositions = this.positionService.getCurrentPositions();
    const initialPositions = this.positionService.getInitialPositions();
    
    if (currentPositions.length === 0 || initialPositions.length === 0) {
      return {
        totalPositionChanges: 0,
        mostActiveDriver: null,
        biggestGainer: null,
        biggestLoser: null
      };
    }

    let totalChanges = 0;
    let biggestGain = 0;
    let biggestLoss = 0;
    let biggestGainer: string | null = null;
    let biggestLoser: string | null = null;

    const positionChanges = new Map<number, number>();

    currentPositions.forEach(current => {
      const initial = initialPositions.find(i => i.driverNumber === current.driverNumber);
      if (initial) {
        const change = initial.position - current.position; // Positive = gained positions
        positionChanges.set(current.driverNumber, change);
        
        if (change !== 0) totalChanges++;
        
        if (change > biggestGain) {
          biggestGain = change;
          biggestGainer = current.driverAcronym || `#${current.driverNumber}`;
        }
        
        if (change < biggestLoss) {
          biggestLoss = change;
          biggestLoser = current.driverAcronym || `#${current.driverNumber}`;
        }
      }
    });

    // Find most active driver (most comments generated)
    const driverCommentCounts = new Map<string, number>();
    this.allComments.forEach(comment => {
      comment.driverNumbers?.forEach(driverNum => {
        const driver = currentPositions.find(p => p.driverNumber === driverNum);
        if (driver) {
          const acronym = driver.driverAcronym || `#${driverNum}`;
          driverCommentCounts.set(acronym, (driverCommentCounts.get(acronym) || 0) + 1);
        }
      });
    });

    const mostActiveDriver = Array.from(driverCommentCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      totalPositionChanges: totalChanges,
      mostActiveDriver,
      biggestGainer,
      biggestLoser
    };
  }

  // Public method to manually generate position insights
  generatePositionInsightsNow(): void {
    const currentPositions = this.positionService.getCurrentPositions();
    const currentTime = this.animationControlService.getCurrentTime();
    
    if (!currentTime || currentPositions.length === 0) {
      console.log('💬 Cannot generate insights: no current time or positions available');
      return;
    }

    console.log('💬 Generating position insights manually...');
    this.generatePositionInsights(currentTime, currentPositions);
    this.commentsSubject.next([...this.allComments]);
  }

  // Public method to generate race summary comment
  generateRaceSummary(): void {
    const stats = this.getPositionStatistics();
    const currentTime = this.animationControlService.getCurrentTime();
    if (!currentTime) return;

    let summaryText = '📊 Race Summary: ';
    const summaryParts: string[] = [];

    // Add total drivers information
    if (this.currentCompleteStandings.length > 0) {
      summaryParts.push(`${this.currentCompleteStandings.length} drivers`);
    }

    if (stats.totalPositionChanges > 0) {
      summaryParts.push(`${stats.totalPositionChanges} position changes`);
    }

    if (stats.biggestGainer) {
      summaryParts.push(`${stats.biggestGainer} biggest climber`);
    }

    if (stats.biggestLoser) {
      summaryParts.push(`${stats.biggestLoser} biggest loser`);
    }

    if (stats.mostActiveDriver) {
      summaryParts.push(`${stats.mostActiveDriver} most active`);
    }

    // Add current leader info
    const currentLeader = this.currentCompleteStandings.find(d => d.position === 1);
    if (currentLeader) {
      summaryParts.push(`${currentLeader.driverAcronym} leading`);
    }

    if (summaryParts.length === 0) {
      summaryText += 'Stable grid positions maintained';
    } else {
      summaryText += summaryParts.join(', ');
    }

    const comment: RaceComment = {
      id: `summary-${currentTime.getTime()}`,
      time: currentTime,
      timeString: this.formatTime(currentTime),
      text: summaryText,
      type: 'info'
    };

    this.allComments.unshift(comment);
    this.commentsSubject.next([...this.allComments]);
  }
}
