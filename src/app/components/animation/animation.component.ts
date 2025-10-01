import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { AnimationControlService } from '../../services/animation-control.service';
import { PositionService } from '../../services/position.service';
import { DriverVisibilityService } from 'src/app/services/driver-visibility.service';
import { RaceCommentaryService } from '../../services/race-commentary.service';
import { LoadingService } from '../../services/loading.service';
import { CarTooltipComponent } from '../car-tooltip/car-tooltip.component';
import { Subscription, forkJoin, of, Observable, merge, BehaviorSubject } from 'rxjs';
import { map, switchMap, shareReplay } from 'rxjs/operators';
import { LapDataService } from '../../services/lap-data.service';
import { CAR_SVG } from '../../shared/utils/car-model';

@Component({
  selector: 'app-animation',
  standalone: true,
  imports: [CommonModule, DatePipe, CarTooltipComponent],
  templateUrl: './animation.component.html',
})
export class AnimationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('animationCanvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private drivers: any[] = [];
  private trajectories = new Map<number, any[]>();
  private carImages = new Map<number, HTMLImageElement>();
  private trackTrajectory: any[] = []; // For drawing the track outline
  private allLocationData: any[] = []; // Store all location data from the API call
  private trackLocked = false; // Prevent track from changing after initial load

  private animationFrameId: number | null = null;
  private currentFrame = 0;
  private isPaused = false;

  private subscriptions: Subscription[] = [];

  // Zoom and Pan properties
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private minZoom = 0.1;
  private maxZoom = 5;
  private resizeObserver?: ResizeObserver; // added
  private hasAutoFitted = false; // added
  
  // Configuration and timing
  private showAllDrivers = true; // Flag to control number of drivers
  private singleDriverNumber = 1; // Driver to show when showAllDrivers is false
  
  // Time-based animation properties
  private sessionStartTime: Date | null = null;
  private sessionEndTime: Date | null = null;
  private raceStartTime: Date | null = null; // Actual race start time
  private currentSimulationTime: Date | null = null;
  private lastUpdateTime: number = 0;
  private speedMultiplier: number = 10;
  // Performance tuning additions
  private desiredFPS = 60;               // Cap render frames per second
  private lastRenderTime = 0;            // Last time we actually rendered
  private interpolationEnabled = true;   // Enable linear interpolation between telemetry points
  private debug = false;                 // Verbose logging toggle
  private perfCounters = { frame: 0, skipped: 0 };

  // Expose observables for template
  currentTime$!: Observable<Date | null>;
  sessionName$!: Observable<string>;

  // Speed options reused from controls
  speedOptions = [0.25,0.5,1,2,5,10,20,50];

  // Tooltip properties
  showTooltip = false;
  tooltipX = 0;
  tooltipY = 0;
  hoveredDriverData: any = null;
  private carPositions = new Map<number, { 
    x: number, 
    y: number, 
    size: number,
    circleX: number,
    circleY: number,
    circleRadius: number,
    detectionRadius: number
  }>(); // Track car positions for hover detection & debug
  private tooltipLockedDriver: number | null = null; // When set, tooltip stays visible
  private showHoverDebug = true; // Toggle with 'h'
  private hoverDebounceTimeout: number | null = null; // For debouncing hover events

  // Race sequence tracking
  private raceSequenceStarted = false;
  private visibilityMap: Record<number, boolean> = {};

  // Lap data
  private lapData: any[] = [];
  private lastLapChunkLoaded = -1;
  private leaderDriverCache: number | null = null;
  currentLapInfo$ = new BehaviorSubject<{ lapNumber: number; lapDuration?: number; speedTrap?: number } | null>(null);

  constructor(
    private openf1ApiService: Openf1ApiService,
    public animationControlService: AnimationControlService,
    private positionService: PositionService,
    private raceCommentaryService: RaceCommentaryService,
    private loadingService: LoadingService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private driverVisibility: DriverVisibilityService,
    private lapDataService: LapDataService
  ) {
    // Initialize speed multiplier from the service
    this.speedMultiplier = this.animationControlService.getSpeedMultiplier();
    this.currentTime$ = this.animationControlService.currentTime$;
    this.sessionName$ = merge(of(null), this.animationControlService.sessionChanged$).pipe(
      switchMap(() => this.openf1ApiService.getSessionInfo()),
      map((sessions: any[]) => {
        const s = sessions && sessions.length ? sessions[0] : null;
        return s ? `${s.circuit_short_name} - ${s.session_name}` : '';
      }),
      shareReplay(1)
    );
  }

  // Template helper methods
  getSpeedMultiplier(): number { return this.animationControlService.getSpeedMultiplier(); }
  getIsPlaying(): boolean { return this.animationControlService.getIsPlaying(); }
  playPause(): void { 
    if (this.getIsPlaying()) {
      this.animationControlService.pause();
    } else {
      this.animationControlService.start();
      // Only trigger race start sequence on the first start
      if (!this.raceSequenceStarted) {
        this.startRaceSequence();
        this.raceSequenceStarted = true;
      }
    }
  }
  restart(): void { 
    this.animationControlService.stop(); 
    // Reset race sequence flag so it can be triggered again on next start
    this.raceSequenceStarted = false;
  }
  increaseSpeed(): void {
    const current = this.animationControlService.getSpeedMultiplier();
    const idx = this.speedOptions.findIndex(s => s === current);
    if (idx < this.speedOptions.length -1) {
      this.animationControlService.setSpeedMultiplier(this.speedOptions[idx+1]);
    }
  }
  decreaseSpeed(): void {
    const current = this.animationControlService.getSpeedMultiplier();
    const idx = this.speedOptions.findIndex(s => s === current);
    if (idx>0) {
      this.animationControlService.setSpeedMultiplier(this.speedOptions[idx-1]);
    }
  }

  ngAfterViewInit(): void {
    const canvasEl = this.canvas.nativeElement;
    const context = canvasEl.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = context;
    
    // Setup responsive canvas
    this.setupResponsiveCanvas();
    this.setupCanvasEventListeners();
    
    this.loadAllDriverData();

    this.subscriptions.push(
      this.animationControlService.start$.subscribe(() => this.startAnimation()),
      this.animationControlService.pause$.subscribe(() => this.pauseAnimation()),
      this.animationControlService.stop$.subscribe(() => this.stopAnimation()),
      this.animationControlService.toggleShowAllDrivers$.subscribe(() => this.toggleShowAllDrivers()),
      this.animationControlService.speedChanged$.subscribe((speed) => this.onSpeedChanged(speed)),
      this.animationControlService.timeSeek$.subscribe((time) => this.seekToTime(time)),
      this.animationControlService.jumpToRaceStart$.subscribe(() => this.jumpToRaceStart()),
      this.animationControlService.raceStartDetected$.subscribe((raceInfo) => this.handleRaceStartDetected(raceInfo)),
      this.animationControlService.speedMultiplier$.subscribe((speed) => {
        this.speedMultiplier = speed;
      }),
      // Repaint immediately when car size scale changes (even if paused)
      this.animationControlService.carSizeScale$.subscribe(() => {
        if (this.ctx) {
          this.drawTrack(); // drawTrack internally calls updateCarsAtCurrentTime
        }
      }),
      this.animationControlService.sessionChanged$.subscribe(() => {
        this.drivers = [];
        this.trajectories.clear();
        this.carImages.clear();
        this.trackTrajectory = [];
        this.sessionStartTime = null;
        this.sessionEndTime = null;
        this.raceStartTime = null;
        this.currentSimulationTime = null;
        this.stopAnimation();
        // Ensure loading modal is hidden when session changes
        this.loadingService.hide();
        this.loadAllDriverData();
      }),
      this.driverVisibility.visibility$.subscribe((mapRec: Record<number, boolean>) => {
        this.visibilityMap = mapRec;
        if (this.currentSimulationTime && this.ctx) {
          this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
          this.drawTrack();
          this.updateCarsAtCurrentTime();
        }
      })
    );
  }

  /**
   * Force repaint of cars - useful for debugging
   * Can be called from browser console with: document.querySelector('app-animation').forceRepaintCars()
   */
  forceRepaintCars(): void {
    console.log('🔄 Force repainting cars...');
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    
    // Redraw track
    this.drawTrack();
    
    // Update cars
    this.updateCarsAtCurrentTime();
    
    // Ensure loading modal is hidden after force repaint
    this.loadingService.hide();
    
    console.log('✅ Force repaint completed');
  }

  /**
   * Debug method to check component state
   */
  debugCarState(): void {
    console.log('🔍 Car State Debug:');
    console.log('- Current simulation time:', this.currentSimulationTime?.toISOString());
    console.log('- Number of drivers:', this.drivers.length);
    console.log('- Car images loaded:', this.carImages.size);
    console.log('- Trajectories loaded:', this.trajectories.size);
    console.log('- Track trajectory points:', this.trackTrajectory.length);
    console.log('- All location data points:', this.allLocationData.length);
    console.log('- Canvas dimensions:', this.canvas.nativeElement.width, 'x', this.canvas.nativeElement.height);
    console.log('- Canvas context:', !!this.ctx);
    
    this.drivers.forEach(driver => {
      const trajectory = this.trajectories.get(driver.driver_number);
      const carImage = this.carImages.get(driver.driver_number);
      console.log(`  Driver ${driver.driver_number}: ${trajectory?.length || 0} points, image: ${carImage ? 'loaded' : 'missing'}`);
    });
  }

  /**
   * Initialize car painting when everything is ready
   * Can be called from browser console to fix missing cars
   */
  initializeCarPainting(): void {
    console.log('🚗 Initializing car painting...');
    
    // Check prerequisites
    if (!this.ctx) {
      console.error('❌ Canvas context not available');
      return;
    }
    
    if (!this.currentSimulationTime) {
      console.error('❌ No current simulation time set');
      return;
    }
    
    if (this.drivers.length === 0) {
      console.error('❌ No drivers loaded');
      return;
    }
    
    if (this.carImages.size === 0) {
      console.error('❌ No car images loaded');
      return;
    }
    
    console.log('✅ All prerequisites met, painting cars...');
    this.forceRepaintCars();
    
    // Ensure loading modal is explicitly hidden
    console.log('🔄 Hiding loading modal after manual car initialization');
    this.loadingService.hide();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); }
    if (this.hoverDebounceTimeout) { clearTimeout(this.hoverDebounceTimeout); }
    if (this.resizeObserver) { try { this.resizeObserver.disconnect(); } catch {} }
    const canvas = this.canvas.nativeElement;
    if (canvas) {
      canvas.removeEventListener('wheel', () => {});
    }
  }

  public toggleShowAllDrivers(): void {
    this.showAllDrivers = !this.showAllDrivers;
    this.drivers = [];
    this.trajectories.clear();
    this.carImages.clear();
    this.trackTrajectory = [];
    this.stopAnimation();
    this.loadAllDriverData();
  }

  loadAllDriverData(): void {
    // First get session timing information
    this.openf1ApiService.getSessionTimeBounds().subscribe(bounds => {
      this.sessionStartTime = bounds.startTime;
      this.sessionEndTime = bounds.endTime;
      this.currentSimulationTime = new Date(bounds.startTime);
      // Ensure the animation control service is immediately updated with the start time
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
    });
  this.openf1ApiService.getDrivers().pipe(
      switchMap(drivers => {
        if (this.showAllDrivers) {
          this.drivers = drivers;
        } else {
          const singleDriver = drivers.find(d => d.driver_number === this.singleDriverNumber);
          this.drivers = singleDriver ? [singleDriver] : [];
        }

        if (this.drivers.length === 0) {
          return of([]);
        }

        // Fetch half-race trajectory for one driver (always driver_number 1 by default) for track outline (cached)
        const trackDriverNumber = this.singleDriverNumber; // can be adjusted if needed
        return this.openf1ApiService.getHalfRaceTrackDriverData(trackDriverNumber).pipe(
          switchMap(trackData => {
            // Set track trajectory immediately
            if (!this.trackLocked) {
              this.trackTrajectory = trackData.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              this.trackLocked = true; // Lock after first assignment
              console.log(`🛣️ Track trajectory points (half race, locked): ${this.trackTrajectory.length}`);
              // Draw only; defer auto-fit until images & layout settled
              this.drawTrack();
            }
            // Then continue with normal all-driver initial data load (first chunk only)
            return this.openf1ApiService.getAllDriversLocationData().pipe(
              switchMap(locationData => {
                // Also load car data
                return this.openf1ApiService.getAllDriversCarData().pipe(
                  map(carData => ({ locationData, carData }))
                );
              })
            );
          })
        );
      })
  ).subscribe((result: any) => {
      const allLocationData = result.locationData || result;
      const allCarData = result.carData || [];
      
      if (allLocationData.length === 0) {
        return;
      }

      console.log(`📊 Processing ${allLocationData.length} location data points from first 5 minutes`);

      // Store all location data for track drawing and simulation
      this.allLocationData = allLocationData;
      
      console.log(`🚗 Loaded ${allCarData.length} car data points for enhanced visualization`);

      // Group location data by driver and filter for our drivers
      this.drivers.forEach(driver => {
        const driverLocations = allLocationData
          .filter((loc: any) => loc.driver_number === driver.driver_number)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        this.trajectories.set(driver.driver_number, driverLocations);
        
        console.log(`🏎️ Driver ${driver.driver_number} (${driver.name_acronym || driver.broadcast_name}): ${driverLocations.length} location points`);
      });

  // Track already set from half-race cached data; do not override here.

      const imageLoadPromises = this.drivers.map(driver => {
        return new Promise<void>(resolve => {
            // Replace the #E43834 color with the team color
            const teamColor = driver.car_color || '#E43834';
            const coloredSvg = CAR_SVG.replace(/#E43834/g, teamColor);
            const blob = new Blob([coloredSvg], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const image = new Image();
            image.src = url;
            image.onload = () => {
                this.carImages.set(driver.driver_number, image);
                URL.revokeObjectURL(url);
                resolve();
            };
        });
      });

      Promise.all(imageLoadPromises).then(() => {
        console.log('🎨 All car images loaded successfully');
        // Detect race start time
        this.detectRaceStart();
        this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
        this.resizeCanvas();
        if (!this.hasAutoFitted) { this.fitTrackToView(); } else { this.drawTrack(); }
        console.log('🏎️ Painting cars at initial time:', this.currentSimulationTime?.toISOString());
        this.updateCarsAtCurrentTime();
        
        // Ensure the time display shows the start time
        if (this.currentSimulationTime) {
          this.animationControlService.setCurrentTime(this.currentSimulationTime);
        }
        
        console.log('✅ Initial car painting completed - cars should be visible now');
        
        // Explicitly hide loading modal after car painting is complete
        console.log('🔄 Hiding loading modal after car painting completion');
        this.loadingService.hide();
        
        // Add a safety mechanism: force repaint after a short delay to ensure cars are visible
        setTimeout(() => {
          console.log('🔄 Safety repaint after 1 second...');
          this.forceRepaintCars();
          // Ensure loading is hidden in safety timer too
          this.loadingService.hide();
        }, 1000);
        
        // Another safety check after 3 seconds
        setTimeout(() => {
          if (this.carImages.size > 0 && this.drivers.length > 0) {
            console.log('🔄 Safety repaint after 3 seconds...');
            this.forceRepaintCars();
            // Final safety to ensure loading is hidden
            this.loadingService.hide();
          }
        }, 3000);
      }).catch(error => {
        console.error('❌ Error loading car images:', error);
        // Ensure loading modal is hidden even if there's an error
        console.log('🔄 Hiding loading modal due to error');
        this.loadingService.hide();
      });
    });

    // Load session key for lap service & initial lap chunk
    this.openf1ApiService.getSessionInfo().subscribe((sessions: any[]) => {
      const key = sessions && sessions.length ? sessions[0].session_key : null;
      if (key) {
        this.lapDataService.setSessionKey(key);
        this.loadLapChunk(0); // initial laps
      }
    });
  }

  private detectRaceStartTime(): void {
    if (this.trajectories.size === 0) return;

    // Get the first driver's trajectory to analyze
    const firstDriverTrajectory = Array.from(this.trajectories.values())[0];
    if (!firstDriverTrajectory || firstDriverTrajectory.length < 10) return;

    // Look for significant movement indicating race start
    let raceStartDetected = false;
    const minimumMovement = 100; // meters - threshold for significant movement
    const consistentPoints = 3; // Number of consecutive points with good movement

    for (let i = 5; i < firstDriverTrajectory.length - consistentPoints; i++) {
      let consistentMovement = 0;
      
      // Check for consecutive points with significant movement
      for (let j = 0; j < consistentPoints; j++) {
        const currentPoint = firstDriverTrajectory[i + j];
        const prevPoint = firstDriverTrajectory[i + j - 1];
        
        if (currentPoint && prevPoint) {
          // Calculate distance moved between points
          const deltaX = currentPoint.x - prevPoint.x;
          const deltaY = currentPoint.y - prevPoint.y;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          // Check if speed is available and above threshold, or distance moved is significant
          const hasSpeed = currentPoint.speed && currentPoint.speed > 50; // 50 km/h
          const hasMovement = distance > minimumMovement;
          
          if (hasSpeed || hasMovement) {
            consistentMovement++;
          }
        }
      }

      // If we found consistent racing activity, this might be race start
      if (consistentMovement >= consistentPoints) {
        this.raceStartTime = new Date(firstDriverTrajectory[i].date);
        raceStartDetected = true;
        console.log('Race start detected at:', this.raceStartTime);
        break;
      }
    }

    // Fallback: if no clear race start detected, look for first significant activity
    if (!raceStartDetected) {
      // Find first point where there's any meaningful movement
      for (let i = 1; i < Math.min(firstDriverTrajectory.length, 100); i++) {
        const currentPoint = firstDriverTrajectory[i];
        const prevPoint = firstDriverTrajectory[i - 1];
        
        const deltaX = currentPoint.x - prevPoint.x;
        const deltaY = currentPoint.y - prevPoint.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance > 50) { // Any movement > 50 meters
          this.raceStartTime = new Date(currentPoint.date);
          console.log('First movement detected at:', this.raceStartTime);
          break;
        }
      }
    }

    // Final fallback: use session start + 5 minutes
    if (!this.raceStartTime && this.sessionStartTime) {
      this.raceStartTime = new Date(this.sessionStartTime.getTime() + (5 * 60 * 1000));
      console.log('Race start estimated at:', this.raceStartTime);
    }
  }

  startAnimation(): void {
    console.log('🚀 startAnimation() called, current state:', {
      hasAnimationFrame: !!this.animationFrameId,
      hasSessionStart: !!this.sessionStartTime,
      currentTime: this.currentSimulationTime?.toISOString(),
      raceStartTime: this.raceStartTime?.toISOString(),
      driversCount: this.drivers.length,
      carImagesLoaded: this.carImages.size
    });

    if (this.animationFrameId || !this.sessionStartTime) {
      return;
    }

    // Start animation from current time - don't auto-jump to race start
    // Let the formation lap play naturally from the beginning
    console.log('▶️ Starting animation from current time:', this.currentSimulationTime?.toISOString());

    // Ensure cars are painted before starting animation
    console.log('🎨 Ensuring cars are painted before animation starts...');
    this.forceRepaintCars();

    this.isPaused = false;
    this.lastUpdateTime = performance.now();
    this.animate();
  }

  pauseAnimation(): void {
    console.log('⏸️ pauseAnimation() called');
    this.isPaused = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Redraw the current state so tooltips continue to work while paused
    this.drawTrack();
  }

  stopAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.sessionStartTime) {
      this.currentSimulationTime = new Date(this.sessionStartTime);
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
      this.updateCarsAtCurrentTime();
    }
    
    // Reset race sequence flag so it can be triggered again on next start
    this.raceSequenceStarted = false;
    
    // Reset dynamic data loading by clearing API service segments
    // This ensures a fresh start when restarting the simulation
    this.clearDynamicDataAndReload();
    
    this.drawTrack();
  }

  onSpeedChanged(speed: number): void {
    this.speedMultiplier = speed;
  }

  seekToTime(targetTime: Date): void {
    this.currentSimulationTime = new Date(targetTime);
    this.animationControlService.setCurrentTime(this.currentSimulationTime);
    this.updateCarsAtCurrentTime();
  this.updateLapInfo();
  }

  jumpToRaceStart(): void {
    if (this.raceStartTime) {
      this.currentSimulationTime = new Date(this.raceStartTime);
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
      this.updateCarsAtCurrentTime();
      console.log('Jumped to race start time:', this.currentSimulationTime);
    } else {
      console.log('Race start time not detected yet');
    }
  }

  private animate(): void {
    if (this.isPaused) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      return;
    }
    if (!this.currentSimulationTime || !this.sessionEndTime) {
      return;
    }
    const now = performance.now();
    const deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    const simulationDelta = deltaTime * this.speedMultiplier; // advance simulation time continuously
    this.currentSimulationTime = new Date(this.currentSimulationTime.getTime() + simulationDelta);
    if (this.currentSimulationTime >= this.sessionEndTime) {
      this.currentSimulationTime = new Date(this.sessionEndTime);
      this.animationControlService.setCurrentTime(this.currentSimulationTime);
      this.updateCarsAtCurrentTime();
      this.stopAnimation();
      return;
    }
    this.animationControlService.setCurrentTime(this.currentSimulationTime);
    this.checkAndLoadMoreDataIfNeeded();
    this.updateLapInfo();
    // Throttle the actual canvas draw to desired FPS (simulation already advanced above)
    const renderInterval = 1000 / this.desiredFPS;
    if (now - this.lastRenderTime >= renderInterval) {
      this.lastRenderTime = now;
      this.perfCounters.frame++;
      this.drawTrack();
      this.updateCarsAtCurrentTime();
    } else {
      this.perfCounters.skipped++;
    }
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private checkAndLoadMoreDataIfNeeded(): void {
    if (!this.currentSimulationTime) return;

    // Use the API service to check and load more data
    this.openf1ApiService.checkAndLoadMoreData(this.currentSimulationTime)
      .subscribe(updatedData => {
        if (updatedData.length > this.allLocationData.length) {
          console.log(`🔄 Loaded additional data: ${updatedData.length - this.allLocationData.length} new points`);
          console.log(`📊 Total simulation coverage: ${(updatedData.length / 1000).toFixed(1)}k data points`);
          
          // Update our stored data
          this.allLocationData = updatedData;

          // Update trajectories for each driver with new data
          this.drivers.forEach(driver => {
            const driverLocations = updatedData
              .filter(loc => loc.driver_number === driver.driver_number)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            this.trajectories.set(driver.driver_number, driverLocations);
            
            console.log(`🏎️ Updated driver ${driver.driver_number}: ${driverLocations.length} total points`);
          });

          // Do NOT update trackTrajectory after it's locked
        }
      });

    // Also check and load car data
    this.openf1ApiService.checkAndLoadMoreCarData(this.currentSimulationTime)
      .subscribe(updatedCarData => {
        if (updatedCarData.length > 0) {
          console.log(`🚗 Car data updated: ${updatedCarData.length} total car data points available`);
        }
      });
  }

  private clearDynamicDataAndReload(): void {
    // Clear the API service's loaded segments
    this.openf1ApiService.clearLoadedSegments();
    
    // Reload the first chunk of data to reset trajectories
    this.openf1ApiService.getAllDriversLocationData().subscribe(allLocationData => {
      if (allLocationData.length === 0) {
        return;
      }

      console.log(`🔄 Reloaded initial data: ${allLocationData.length} location points after restart`);

      // Store all location data for track drawing and simulation
      this.allLocationData = allLocationData;

      // Update trajectories for each driver
      this.drivers.forEach(driver => {
        const driverLocations = allLocationData
          .filter(loc => loc.driver_number === driver.driver_number)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        this.trajectories.set(driver.driver_number, driverLocations);
        
        console.log(`🏎️ Reset driver ${driver.driver_number}: ${driverLocations.length} location points`);
      });

  // Preserve existing locked track; don't overwrite
    });
  // Reset lap data
  this.lapData = [];
     this.lastLapChunkLoaded = -1;
  this.currentLapInfo$.next(null);
  this.loadLapChunk(0);
  }

  private updateCarsAtCurrentTime(): void {
    if (!this.currentSimulationTime) {
      if (this.debug) console.log('No current simulation time');
      return;
    }
    if (this.debug) console.log('Render @', this.currentSimulationTime.toISOString());
    let carsPainted = 0;
    this.drivers.forEach(driver => {
      const driverTrajectory = this.trajectories.get(driver.driver_number);
      if (this.visibilityMap[driver.driver_number] === false) return;
      if (driverTrajectory && driverTrajectory.length > 0) {
        const position = this.findInterpolatedPositionAtTime(driverTrajectory, this.currentSimulationTime!);
        if (position) {
          this.drawCar(position, driver.driver_number);
          carsPainted++;
        }
      }
    });
    if (this.debug) console.log(`Painted ${carsPainted}/${this.drivers.length}`);
    this.updateLapInfo();
    if (this.tooltipLockedDriver !== null && this.showTooltip) {
      const lockPos = this.carPositions.get(this.tooltipLockedDriver);
      if (lockPos) {
        const canvasRect = this.canvas.nativeElement.getBoundingClientRect();
        const screenX = canvasRect.left + lockPos.circleX + 15;
        const screenY = canvasRect.top + lockPos.circleY - 20;
        this.tooltipX = Math.min(screenX, window.innerWidth - 240);
        this.tooltipY = Math.max(screenY, 10);
      }
    }
  }

  /** Determine leader driver number (cached per tick) */
  private determineLeaderDriver(): number | null {
    if (this.drivers.length === 0) return null;
    let leader: number | null = null;
    let bestPos = Number.MAX_SAFE_INTEGER;
    for (const d of this.drivers) {
      const posData = this.positionService.getDriverPosition(d.driver_number);
      const pos = posData?.position;
      if (pos && pos < bestPos) {
        bestPos = pos;
        leader = d.driver_number;
      }
    }
    if (leader === null) leader = this.drivers[0].driver_number;
    this.leaderDriverCache = leader;
    return leader;
  }

  /** Load a lap chunk by index */
  private loadLapChunk(index: number): void {
    if (index <= this.lastLapChunkLoaded) return;
    this.lapDataService.loadLapDataChunk(index).subscribe(all => {
      this.lapData = all;
      this.lastLapChunkLoaded = Math.max(this.lastLapChunkLoaded, index);
      this.updateLapInfo();
    });
  }

  /** Update current lap info observable */
  private updateLapInfo(): void {
    if (!this.currentSimulationTime || this.lapData.length === 0) return;
    const leader = this.determineLeaderDriver();
    if (leader == null) return;

    // Filter lap entries for leader with date_start <= current simulation time
    const leaderLaps = this.lapData
      .filter(l => l.driver_number === leader && new Date(l.date_start).getTime() <= this.currentSimulationTime!.getTime())
      .sort((a, b) => a.lap_number - b.lap_number);

    if (leaderLaps.length === 0) return;
    const currentLap = leaderLaps[leaderLaps.length - 1];

    // Emit current lap info
    const payload = {
      lapNumber: currentLap.lap_number,
      lapDuration: currentLap.lap_duration,
      speedTrap: currentLap.st_speed
    };
    this.currentLapInfo$.next(payload);

    // Preload next lap chunk if needed
    if (this.lapDataService.shouldPreloadNextChunk(currentLap.lap_number)) {
      const nextChunk = Math.floor((currentLap.lap_number - 1) / 10) + 1;
      this.loadLapChunk(nextChunk);
    }
  }

  private findPositionAtTime(trajectory: any[], targetTime: Date): any | null {
    if (trajectory.length === 0) return null;
    const targetTimestamp = targetTime.getTime();
    let closestIndex = 0;
    let closestDiff = Math.abs(new Date(trajectory[0].date).getTime() - targetTimestamp);
    for (let i = 1; i < trajectory.length; i++) {
      const diff = Math.abs(new Date(trajectory[i].date).getTime() - targetTimestamp);
      if (diff < closestDiff) { closestDiff = diff; closestIndex = i; } else { break; }
    }
    return trajectory[closestIndex];
  }
  // Binary search + interpolation (optional) for smoother motion & O(log n) lookup
  private findInterpolatedPositionAtTime(trajectory: any[], targetTime: Date): any | null {
    if (trajectory.length === 0) return null;
    const target = targetTime.getTime();
    let lo = 0, hi = trajectory.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1; const tMid = new Date(trajectory[mid].date).getTime();
      if (tMid === target) return trajectory[mid];
      if (tMid < target) lo = mid + 1; else hi = mid - 1;
    }
    const beforeIdx = Math.max(0, Math.min(hi, trajectory.length - 1));
    const afterIdx = Math.max(0, Math.min(lo, trajectory.length - 1));
    const before = trajectory[beforeIdx]; const after = trajectory[afterIdx];
    if (!this.interpolationEnabled || beforeIdx === afterIdx) return before || after || null;
    const tBefore = new Date(before.date).getTime(); const tAfter = new Date(after.date).getTime();
    if (tAfter === tBefore) return before;
    const ratio = (target - tBefore) / (tAfter - tBefore);
    return { ...before, x: before.x + (after.x - before.x) * ratio, y: before.y + (after.y - before.y) * ratio };
  }

  private setupResponsiveCanvas(): void {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    const parent = this.canvas.nativeElement.parentElement as HTMLElement | null;
    if (parent && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            this.resizeCanvas();
            if (!this.hasAutoFitted && this.trackTrajectory.length) {
              this.fitTrackToView();
            }
          }
        }
      });
      this.resizeObserver.observe(parent);
    }
  }

  private resizeCanvas(): void {
    const canvas = this.canvas.nativeElement;
    const container = canvas.parentElement as HTMLElement | null;
    if (!container) return;

    const containerWidth = container.clientWidth;
    let containerHeight = container.clientHeight;

    // If container has no explicit height yet, derive a proportional one
    if (!containerHeight || containerHeight < 50) {
      containerHeight = Math.min(containerWidth * 0.55, 720);
    }

    // Adjust for detached HUD bar if present above (desktop scenario)
    const rootMain = container.closest('.main-content');
    if (rootMain && window.innerWidth < 1703) {
      const hud = rootMain.querySelector('.detached-hud-bar') as HTMLElement | null;
      if (hud) {
        const hudStyles = getComputedStyle(hud);
        const hudHeight = hud.offsetHeight + parseFloat(hudStyles.marginTop) + parseFloat(hudStyles.marginBottom);
        // Reduce available height only if HUD is absolutely positioned? If not absolute it's already affecting layout.
        const hudIsAbsolute = hudStyles.position === 'absolute';
        if (hudIsAbsolute) {
          containerHeight = Math.max(100, containerHeight - hudHeight - 8);
        }
      }
    }

    // Apply pixel dimensions to backing store
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Reflect sizing via style to avoid overflow
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';

    if (this.trackTrajectory.length > 0) {
      this.drawTrack();
    }
  }

  private setupCanvasEventListeners(): void {
    const canvas = this.canvas.nativeElement;
    // Prefer unified Pointer Events for mouse + touch + pen
    if ((window as any).PointerEvent) {
      canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return; // primary button / touch contact
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
      });

      canvas.addEventListener('pointermove', (e: PointerEvent) => {
        if (!this.isDragging) {
          // Hover logic still for mouse, skip for touch
          if (e.pointerType === 'mouse') {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.debouncedHoverCheck(mouseX, mouseY, e.clientX, e.clientY);
          }
          return;
        }
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        this.panX += deltaX;
        this.panY += deltaY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.updateLockedTooltipPosition();
        this.drawTrack();
        // Prevent page scroll on touch while panning
        if (e.pointerType === 'touch') e.preventDefault();
      }, { passive: false });

      const endPointer = (e: PointerEvent) => {
        if (this.isDragging) {
          this.isDragging = false;
          canvas.style.cursor = 'grab';
          try { canvas.releasePointerCapture(e.pointerId); } catch {}
        }
      };
      canvas.addEventListener('pointerup', endPointer);
      canvas.addEventListener('pointercancel', endPointer);
      canvas.addEventListener('pointerleave', () => { this.isDragging = false; canvas.style.cursor = 'grab'; });
    }
    
    // Mouse wheel for zoom
    canvas.addEventListener('wheel', (e) => {
      // Only handle zoom when user holds Ctrl (Windows/Linux) or Meta/Cmd (macOS)
      if (!(e.ctrlKey || e.metaKey)) {
        return; // allow normal scroll / ignore zoom
      }
      // Prevent browser page zoom
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Use smaller incremental factor for finer control
      const direction = e.deltaY > 0 ? -1 : 1; // wheel down -> zoom out
      const step = 0.12; // sensitivity
      const zoomFactor = 1 + direction * step;
      const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

      if (newZoom !== this.zoom) {
        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;
        this.zoom = newZoom;
        this.panX = mouseX - worldX * this.zoom;
        this.panY = mouseY - worldY * this.zoom;
        this.updateLockedTooltipPosition();
        this.drawTrack();
      }
    }, { passive: false });

    // Fallback classic mouse listeners (skip if pointer events present to avoid duplication)
    if (!(window as any).PointerEvent) {
      canvas.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
      });
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (this.isDragging) {
          const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            this.panX += deltaX;
            this.panY += deltaY;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.updateLockedTooltipPosition();
            this.drawTrack();
        } else {
          this.debouncedHoverCheck(mouseX, mouseY, e.clientX, e.clientY);
        }
      });
      canvas.addEventListener('mouseup', () => { this.isDragging = false; canvas.style.cursor = 'grab'; });
      canvas.addEventListener('mouseleave', () => { this.isDragging = false; canvas.style.cursor = 'default'; this.hideTooltip(); });
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const clickedDriver = this.findDriverHitAt(mouseX, mouseY);
        if (clickedDriver !== null) {
          if (this.tooltipLockedDriver === clickedDriver) { this.tooltipLockedDriver = null; this.hideTooltip(true); return; }
          this.tooltipLockedDriver = clickedDriver;
          this.showCarTooltip(clickedDriver, e.clientX, e.clientY, true);
        } else if (this.tooltipLockedDriver !== null) {
          this.tooltipLockedDriver = null; this.hideTooltip(true);
        }
      });
    } else {
      // Separate click handler (pointerup) for locking tooltip when pointer events active
      canvas.addEventListener('pointerup', (e: PointerEvent) => {
        if (e.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const clickedDriver = this.findDriverHitAt(mouseX, mouseY);
        if (clickedDriver !== null) {
          if (this.tooltipLockedDriver === clickedDriver) { this.tooltipLockedDriver = null; this.hideTooltip(true); return; }
          this.tooltipLockedDriver = clickedDriver;
          this.showCarTooltip(clickedDriver, e.clientX, e.clientY, true);
        } else if (this.tooltipLockedDriver !== null) {
          this.tooltipLockedDriver = null; this.hideTooltip(true);
        }
      });
    }

    // Set initial cursor
    canvas.style.cursor = 'grab';
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeCanvas();
  }

  // Zoom control methods
  public zoomIn(): void {
    const newZoom = Math.min(this.maxZoom, this.zoom * 1.2);
    if (newZoom !== this.zoom) {
      const canvas = this.canvas.nativeElement;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      const worldX = (centerX - this.panX) / this.zoom;
      const worldY = (centerY - this.panY) / this.zoom;
      
      this.zoom = newZoom;
      
      this.panX = centerX - worldX * this.zoom;
      this.panY = centerY - worldY * this.zoom;
      
      // Update locked tooltip position if present
      this.updateLockedTooltipPosition();
      
      this.drawTrack();
    }
  }

  public zoomOut(): void {
    const newZoom = Math.max(this.minZoom, this.zoom * 0.8);
    if (newZoom !== this.zoom) {
      const canvas = this.canvas.nativeElement;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      const worldX = (centerX - this.panX) / this.zoom;
      const worldY = (centerY - this.panY) / this.zoom;
      
      this.zoom = newZoom;
      
      this.panX = centerX - worldX * this.zoom;
      this.panY = centerY - worldY * this.zoom;
      
      // Update locked tooltip position if present
      this.updateLockedTooltipPosition();
      
      this.drawTrack();
    }
  }

  public resetZoom(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    
    // Update locked tooltip position if present
    this.updateLockedTooltipPosition();
    
    this.drawTrack();
  }

  private getScaleAndOffset() {
    if (this.trackTrajectory.length === 0) {
        return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    const xCoords = this.trackTrajectory.map(d => d.x);
    const yCoords = this.trackTrajectory.map(d => d.y);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const canvasWidth = this.canvas.nativeElement.width;
    const canvasHeight = this.canvas.nativeElement.height;

    const scaleX = canvasWidth / (maxX - minX);
    const scaleY = canvasHeight / (maxY - minY);
    const baseScale = Math.min(scaleX, scaleY) * 0.9;

    // Apply zoom
    const scale = baseScale * this.zoom;

    // Calculate base offset for centering, then apply pan
    const baseOffsetX = (canvasWidth - (maxX - minX) * baseScale) / 2 - minX * baseScale;
    const baseOffsetY = (canvasHeight - (maxY - minY) * baseScale) / 2 - minY * baseScale;
    
    const offsetX = baseOffsetX * this.zoom + this.panX;
    const offsetY = baseOffsetY * this.zoom + this.panY;

    return { scale, offsetX, offsetY };
  }

  /**
   * Reset zoom/pan so that the computed base scale fully fits the track inside the canvas.
   * Call after track data & canvas sizing are stable (after images load / layout settle).
   */
  private fitTrackToView(): void {
    if (this.trackTrajectory.length === 0) return;
    this.zoom = 1; this.panX = 0; this.panY = 0;
    this.drawTrack();
    this.hasAutoFitted = true;
    console.log('🗺️ Auto-fit applied (once)');
  }

  drawTrack(): void {
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    if (this.trackTrajectory.length === 0) return;

    const { scale, offsetX, offsetY } = this.getScaleAndOffset();

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'black';
    // Scale line width with zoom (minimum 1px, maximum 6px)
    this.ctx.lineWidth = Math.max(1, Math.min(6, 2 * this.zoom));

    this.trackTrajectory.forEach((p, index) => {
      const x = p.x * scale + offsetX;
      const y = p.y * scale + offsetY;
      if (index === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Redraw cars at current time position after drawing track
    this.updateCarsAtCurrentTime();
  }

  drawCar(position: any, driverNumber: number): void {
    const carImage = this.carImages.get(driverNumber);
    if (!carImage) { if (this.debug) console.log('missing image', driverNumber); return; }
    const { scale, offsetX, offsetY } = this.getScaleAndOffset();
    const x = position.x * scale + offsetX;
    const y = position.y * scale + offsetY;
    if (this.debug) console.log('car', driverNumber, x, y);
    const driver = this.drivers.find(d => d.driver_number === driverNumber);
    const teamColor = driver?.car_color || '#E43834';
    const sizeScale = this.animationControlService.getCarSizeScale ? this.animationControlService.getCarSizeScale() : 1;
    const baseCarSize = 24 * sizeScale, baseCircleRadius = 8 * sizeScale, baseCircleOffset = 10 * sizeScale, baseFontSize = 8 * sizeScale;
    const carSize = Math.max(8, Math.min(72, baseCarSize * this.zoom));
    const circleRadius = Math.max(3, Math.min(22, baseCircleRadius * this.zoom));
    const circleOffset = Math.max(4, Math.min(28, baseCircleOffset * this.zoom));
    const fontSize = Math.max(5, Math.min(24, baseFontSize * this.zoom));
    const circleX = x + circleOffset; const circleY = y - circleOffset; const detectionRadius = Math.max(circleRadius + 4, 14);
    this.carPositions.set(driverNumber, { x, y, size: carSize, circleX, circleY, circleRadius, detectionRadius });
    const driverTrajectory = this.trajectories.get(driverNumber);
    let rotation = 0;
    if (driverTrajectory && this.currentSimulationTime) {
      const prevTime = this.currentSimulationTime.getTime() - 1000;
      const prevPosition = this.findInterpolatedPositionAtTime(driverTrajectory, new Date(prevTime));
      if (prevPosition && (position.x !== prevPosition.x || position.y !== prevPosition.y)) {
        const deltaX = position.x - prevPosition.x; const deltaY = position.y - prevPosition.y;
        rotation = Math.atan2(deltaY, deltaX);
      }
    }
    this.ctx.save(); this.ctx.translate(x, y); this.ctx.rotate(rotation);
    const halfCarSize = carSize / 2; this.ctx.drawImage(carImage, -halfCarSize, -halfCarSize, carSize, carSize); this.ctx.restore();
    this.ctx.beginPath(); this.ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI); this.ctx.fillStyle = teamColor; this.ctx.fill();
    this.ctx.strokeStyle = 'white'; this.ctx.lineWidth = Math.max(1, Math.min(3, 1 * this.zoom)); this.ctx.stroke();
    this.ctx.fillStyle = 'white'; this.ctx.font = `bold ${fontSize}px Arial`; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle'; this.ctx.fillText(String(driverNumber), circleX, circleY);
    this.ctx.textBaseline = 'alphabetic';
  }

  /**
   * Debounced hover check for better performance during rapid mouse movement
   */
  private debouncedHoverCheck(canvasX: number, canvasY: number, clientX: number, clientY: number): void {
    // Clear existing timeout
    if (this.hoverDebounceTimeout) {
      clearTimeout(this.hoverDebounceTimeout);
    }
    
    // Set new timeout for hover check
    this.hoverDebounceTimeout = window.setTimeout(() => {
      this.handleCarHover(canvasX, canvasY, clientX, clientY);
    }, 16); // ~60fps responsiveness
  }

  /**
   * Handle car hover detection - improved for zoom/pan consistency
   */
  private handleCarHover(canvasX: number, canvasY: number, clientX: number, clientY: number): void {
    // If locked, ignore hover except for updating position when hovering same circle
    if (this.tooltipLockedDriver !== null) {
      const lockedPos = this.carPositions.get(this.tooltipLockedDriver);
      if (lockedPos) {
        // Keep tooltip static when locked (could enhance to follow circle)
      }
      return;
    }
    
    const hoveredDriver = this.findDriverHitAt(canvasX, canvasY);
    const canvas = this.canvas.nativeElement;
    
    if (hoveredDriver !== null) {
      // Change cursor to pointer when hovering over a driver
      canvas.style.cursor = 'pointer';
      this.showCarTooltip(hoveredDriver, clientX, clientY, false);
    } else {
      // Reset cursor to grab when not hovering over a driver
      canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
      if (this.showTooltip) {
        this.hideTooltip();
      }
    }
  }

  /**
   * Find which driver's number circle (if any) is at the given canvas coordinates
   * Improved version that recalculates world coordinates on the fly
   */
  private findDriverHitAt(canvasX: number, canvasY: number): number | null {
    if (!this.currentSimulationTime) return null;
    
    let bestDriver: number | null = null;
    let bestMetric = Number.POSITIVE_INFINITY;
    
    // Convert canvas coordinates to world coordinates for accurate hit testing
    const worldX = (canvasX - this.panX) / this.zoom;
    const worldY = (canvasY - this.panY) / this.zoom;
    
    const { scale, offsetX, offsetY } = this.getScaleAndOffset();
    
    for (const driver of this.drivers) {
      const driverNumber = driver.driver_number;
      const driverTrajectory = this.trajectories.get(driverNumber);
      if (!driverTrajectory || driverTrajectory.length === 0) continue;
      
      // Find current position for this driver
      const position = this.findPositionAtTime(driverTrajectory, this.currentSimulationTime);
      if (!position) continue;
      
      // Calculate current screen coordinates for this driver
      const screenX = position.x * scale + offsetX;
      const screenY = position.y * scale + offsetY;
      
      // Calculate scaled sizes based on current zoom level
      const baseCarSize = 24;
      const baseCircleRadius = 8;
      const baseCircleOffset = 10;
      
      const carSize = Math.max(12, Math.min(48, baseCarSize * this.zoom));
      const circleRadius = Math.max(4, Math.min(16, baseCircleRadius * this.zoom));
      const circleOffset = Math.max(5, Math.min(20, baseCircleOffset * this.zoom));
      
      const circleX = screenX + circleOffset;
      const circleY = screenY - circleOffset;
      const detectionRadius = Math.max(circleRadius + 4, 14);
      
      // Check circle hit (driver number)
      const dxC = canvasX - circleX;
      const dyC = canvasY - circleY;
      const circleDistance = Math.sqrt(dxC * dxC + dyC * dyC);
      const circleHit = circleDistance <= detectionRadius;
      
      // Check car body hit
      const dxB = canvasX - screenX;
      const dyB = canvasY - screenY;
      const bodyDistance = Math.sqrt(dxB * dxB + dyB * dyB);
      const bodyRadius = carSize / 2 + 10;
      const bodyHit = bodyDistance <= bodyRadius;
      
      if (circleHit || bodyHit) {
        // Prefer circle proximity (subtract small bias) so number circle chosen when overlapping both
        const metric = circleHit ? circleDistance - 3 : bodyDistance;
        if (metric < bestMetric) {
          bestMetric = metric;
          bestDriver = driverNumber;
        }
      }
    }
    
    return bestDriver;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    if (key === 'h') {
      this.showHoverDebug = !this.showHoverDebug;
      console.log(`🔍 Hover debug ${this.showHoverDebug ? 'enabled' : 'disabled'}`);
      this.drawTrack();
      return;
    }
    if (key === ' ' || key === 'spacebar') {
      // Avoid triggering when user is typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      this.playPause();
      console.log('␣ Spacebar toggle play/pause');
      return;
    }
  }

  /**
   * Show tooltip for a specific driver
   */
  private showCarTooltip(driverNumber: number, clientX: number, clientY: number, locked: boolean = false): void {
    // Get driver information
    const driver = this.drivers.find(d => d.driver_number === driverNumber);
    if (!driver) {
      console.log(`❌ No driver found for driverNumber: ${driverNumber}`);
      return;
    }

    // Get current position data for this driver
    const driverPositionData = this.positionService.getDriverPosition(driverNumber);
    
    // Get car data if available
    const carData = this.currentSimulationTime ? 
      this.openf1ApiService.getDriverCarDataAtTime(driverNumber, this.currentSimulationTime, 5000) : null;

    const tooltipData = {
      driverNumber: driverNumber,
      driverName: `${driver.first_name} ${driver.last_name}`,
      driverAcronym: driver.name_acronym || driver.broadcast_name || `#${driverNumber}`,
      teamColor: driver.car_color || '#888888',
      teamName: driver.team_name || 'Unknown',
      position: driverPositionData?.position || 'N/A',
      carData: carData
    };

    // Debug log the exact tooltip data being displayed
    console.log(`🏎️ Tooltip Data for Driver ${driverNumber}:`, {
      hoveredDriverData: this.hoveredDriverData,
      rawDriverInfo: driver,
      rawPositionData: driverPositionData,
      rawCarData: carData,
      currentSimulationTime: this.currentSimulationTime?.toISOString()
    });

    // Position tooltip near mouse but avoid edges
    const tooltipOffset = 15;
  // If locked, nudge position a bit differently so user can tell it's pinned
    this.ngZone.run(() => {
      this.hoveredDriverData = tooltipData;
      const xOffset = locked ? 25 : tooltipOffset;
      const yOffset = locked ? 120 : 100;
      this.tooltipX = Math.min(clientX + xOffset, window.innerWidth - 220);
      this.tooltipY = Math.max(clientY - yOffset, 10);
      this.showTooltip = true;
      if (locked) {
        console.log(`📌 Locked tooltip for driver ${driverNumber} at (${this.tooltipX}, ${this.tooltipY})`);
      } else {
        console.log(`👆 Hover tooltip for driver ${driverNumber} at (${this.tooltipX}, ${this.tooltipY})`);
      }
      this.cdr.detectChanges();
    });
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(force: boolean = false): void {
    if (this.tooltipLockedDriver !== null && !force) return; // Don't hide if locked unless forced
    this.ngZone.run(() => {
      this.showTooltip = false;
      this.hoveredDriverData = null;
      this.cdr.detectChanges();
    });
  }

  /**
   * Update locked tooltip position when zooming/panning
   */
  private updateLockedTooltipPosition(): void {
    if (this.tooltipLockedDriver === null || !this.showTooltip || !this.currentSimulationTime) {
      return;
    }

    // Find current position of the locked driver
    const driverTrajectory = this.trajectories.get(this.tooltipLockedDriver);
    if (!driverTrajectory || driverTrajectory.length === 0) return;

    const position = this.findPositionAtTime(driverTrajectory, this.currentSimulationTime);
    if (!position) return;

    // Calculate current screen coordinates
    const { scale, offsetX, offsetY } = this.getScaleAndOffset();
    const screenX = position.x * scale + offsetX;
    const screenY = position.y * scale + offsetY;

    // Convert screen coordinates to client coordinates
    const canvas = this.canvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + screenX;
    const clientY = rect.top + screenY;

    // Update tooltip position with locked offset
    this.ngZone.run(() => {
      const xOffset = 25; // locked offset
      const yOffset = 120; // locked offset
      this.tooltipX = Math.min(clientX + xOffset, window.innerWidth - 220);
      this.tooltipY = Math.max(clientY - yOffset, 10);
      this.cdr.detectChanges();
    });
  }

  /**
   * Handle race start detection event
   */
  private handleRaceStartDetected(raceInfo: { raceStartTime: Date, isFormationLap: boolean }): void {
    this.raceStartTime = raceInfo.raceStartTime;
    
    // Don't jump to race start time - let the formation lap play naturally
    // Just store the race start time for reference and start the comment sequence
    if (raceInfo.isFormationLap) {
      console.log('🏁 Formation lap detected - race will start naturally with comments');
      console.log(`🏁 Race start time set to: ${raceInfo.raceStartTime.toISOString()}`);
    } else {
      console.log('🏁 Direct race start detected - no formation lap');
    }
  }

  /**
   * Detect race start time and formation lap
   */
  private detectRaceStart(): void {
    this.openf1ApiService.detectRaceStart().subscribe({
      next: (raceInfo) => {
        this.animationControlService.setRaceStartInfo(raceInfo.raceStartTime, raceInfo.isFormationLap);
        this.handleRaceStartDetected(raceInfo);
      },
      error: (error) => {
        console.warn('Could not detect race start:', error);
        // Fallback to session start time
        if (this.sessionStartTime) {
          this.animationControlService.setRaceStartInfo(this.sessionStartTime, false);
        }
      }
    });
  }

  /**
   * Start the race sequence with comments (called when user presses start)
   */
  startRaceSequence(): void {
    // Execute the race start sequence through comments when user starts
    this.raceCommentaryService.executeRaceStartSequence();
    console.log('🏁 Race sequence started with comments - formation lap begins');
  }
}