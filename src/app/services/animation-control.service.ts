import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnimationControlService {
  private startSubject = new Subject<void>();
  private pauseSubject = new Subject<void>();
  private stopSubject = new Subject<void>();
  private toggleShowAllDriversSubject = new Subject<void>();
  private sessionChangedSubject = new Subject<number>();
  private speedChangedSubject = new Subject<number>();
  private timeSeekSubject = new Subject<Date>();

  // Speed multiplier: 1 = real time, 2 = 2x speed, 0.5 = half speed, etc.
  private speedMultiplierSubject = new BehaviorSubject<number>(10);
  // Current simulation time
  private currentTimeSubject = new BehaviorSubject<Date | null>(null);

  start$ = this.startSubject.asObservable();
  pause$ = this.pauseSubject.asObservable();
  stop$ = this.stopSubject.asObservable();
  toggleShowAllDrivers$ = this.toggleShowAllDriversSubject.asObservable();
  sessionChanged$ = this.sessionChangedSubject.asObservable();
  speedChanged$ = this.speedChangedSubject.asObservable();
  timeSeek$ = this.timeSeekSubject.asObservable();
  speedMultiplier$ = this.speedMultiplierSubject.asObservable();
  currentTime$ = this.currentTimeSubject.asObservable();

  start() {
    this.startSubject.next();
  }

  pause() {
    this.pauseSubject.next();
  }

  stop() {
    this.stopSubject.next();
  }

  toggleShowAllDrivers() {
    this.toggleShowAllDriversSubject.next();
  }

  changeSession(sessionKey: number) {
    this.sessionChangedSubject.next(sessionKey);
  }

  setSpeedMultiplier(speed: number) {
    this.speedMultiplierSubject.next(speed);
    this.speedChangedSubject.next(speed);
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplierSubject.value;
  }

  setCurrentTime(time: Date) {
    this.currentTimeSubject.next(time);
  }

  getCurrentTime(): Date | null {
    return this.currentTimeSubject.value;
  }

  seekToTime(time: Date) {
    this.timeSeekSubject.next(time);
  }
}
