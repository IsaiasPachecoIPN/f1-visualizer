import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { AnimationControlService } from '../../services/animation-control.service';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-animation',
  standalone: true,
  templateUrl: './animation.component.html',
})
export class AnimationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('animationCanvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private drivers: any[] = [];
  private trajectories = new Map<number, any[]>();
  private trackTrajectory: any[] = []; // For drawing the track outline

  private animationFrameId: number | null = null;
  private currentFrame = 0;
  private isPaused = false;

  private subscriptions: Subscription[] = [];

  // Configuration
  private readonly SESSION_KEY = 9181; // Mexico City GP 2023
  private readonly MASS_QUERY_START_TIME = '2023-10-29T20:30:00+00:00';
  private showAllDrivers = false; // Flag to control number of drivers
  private singleDriverNumber = 1; // Driver to show when showAllDrivers is false

  constructor(
    private openf1ApiService: Openf1ApiService,
    private animationControlService: AnimationControlService
  ) {}

  ngAfterViewInit(): void {
    const canvasEl = this.canvas.nativeElement;
    const context = canvasEl.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = context;
    this.loadAllDriverData();

    this.subscriptions.push(
      this.animationControlService.start$.subscribe(() => this.startAnimation()),
      this.animationControlService.pause$.subscribe(() => this.pauseAnimation()),
      this.animationControlService.stop$.subscribe(() => this.stopAnimation()),
      this.animationControlService.toggleShowAllDrivers$.subscribe(() => this.toggleShowAllDrivers())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public toggleShowAllDrivers(): void {
    this.showAllDrivers = !this.showAllDrivers;
    // Reset trajectories and drivers
    this.drivers = [];
    this.trajectories.clear();
    this.trackTrajectory = [];
    this.stopAnimation(); // Stop current animation before loading new data
    this.loadAllDriverData();
  }

  loadAllDriverData(): void {
    this.openf1ApiService.getDrivers(this.SESSION_KEY).pipe(
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

        // Use the first driver in the (potentially filtered) list for the track
        this.openf1ApiService.getDriverFullTrajectory(this.SESSION_KEY, this.drivers[0].driver_number, this.MASS_QUERY_START_TIME)
          .subscribe(data => {
            this.trackTrajectory = data;
            this.drawTrack();
          });

        const trajectoryObservables = this.drivers.map(driver =>
          this.openf1ApiService.getDriverFullTrajectory(this.SESSION_KEY, driver.driver_number, this.MASS_QUERY_START_TIME)
        );

        return forkJoin(trajectoryObservables);
      })
    ).subscribe(allTrajectories => {
      allTrajectories.forEach((trajectory, index) => {
        const driver = this.drivers[index];
        this.trajectories.set(driver.driver_number, trajectory);
      });
    });
  }

  startAnimation(): void {
    if (this.animationFrameId) {
      return; // Already running
    }
    this.isPaused = false;
    this.animate();
  }

  pauseAnimation(): void {
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.animate();
    }
  }

  stopAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.currentFrame = 0;
    this.drawTrack(); // Redraw the track to clear cars
  }

  private animate(): void {
    const maxFrames = Math.max(...Array.from(this.trajectories.values()).map(t => t.length));
    if (this.isPaused || this.currentFrame >= maxFrames) {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      return;
    }

    this.drawTrack();

    this.drivers.forEach(driver => {
      const driverTrajectory = this.trajectories.get(driver.driver_number);
      if (driverTrajectory && this.currentFrame < driverTrajectory.length) {
        const position = driverTrajectory[this.currentFrame];
        this.drawCar(position, driver.car_color);
      }
    });

    this.currentFrame++;
    this.animationFrameId = requestAnimationFrame(() => this.animate());
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
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (canvasWidth - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = (canvasHeight - (maxY - minY) * scale) / 2 - minY * scale;

    return { scale, offsetX, offsetY };
  }

  drawTrack(): void {
    this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    if (this.trackTrajectory.length === 0) return;

    const { scale, offsetX, offsetY } = this.getScaleAndOffset();

    this.ctx.beginPath();
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 2;

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
  }

  drawCar(position: any, color: string): void {
    const { scale, offsetX, offsetY } = this.getScaleAndOffset();
    const x = position.x * scale + offsetX;
    const y = position.y * scale + offsetY;

    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }
}
