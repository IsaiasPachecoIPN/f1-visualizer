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
  private jumpToRaceStartSubject = new Subject<void>();
  private raceStartDetectedSubject = new Subject<{ raceStartTime: Date, isFormationLap: boolean }>();

  // Speed multiplier: 1 = real time, 2 = 2x speed, 0.5 = half speed, etc.
  private speedMultiplierSubject = new BehaviorSubject<number>(10);
  // Current simulation time
  private currentTimeSubject = new BehaviorSubject<Date | null>(null);
  // Playing state
  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  // Race start information
  private raceStartTimeSubject = new BehaviorSubject<Date | null>(null);
  private isFormationLapSubject = new BehaviorSubject<boolean>(false);
  // Global car size scale (1 = default 24px base). Clamp between 0.5 and 3.
  private carSizeScaleSubject = new BehaviorSubject<number>(1);

  start$ = this.startSubject.asObservable();
  pause$ = this.pauseSubject.asObservable();
  stop$ = this.stopSubject.asObservable();
  toggleShowAllDrivers$ = this.toggleShowAllDriversSubject.asObservable();
  sessionChanged$ = this.sessionChangedSubject.asObservable();
  speedChanged$ = this.speedChangedSubject.asObservable();
  timeSeek$ = this.timeSeekSubject.asObservable();
  jumpToRaceStart$ = this.jumpToRaceStartSubject.asObservable();
  raceStartDetected$ = this.raceStartDetectedSubject.asObservable();
  speedMultiplier$ = this.speedMultiplierSubject.asObservable();
  currentTime$ = this.currentTimeSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();
  raceStartTime$ = this.raceStartTimeSubject.asObservable();
  isFormationLap$ = this.isFormationLapSubject.asObservable();
  carSizeScale$ = this.carSizeScaleSubject.asObservable();

  start() {
    this.isPlayingSubject.next(true);
    this.startSubject.next();
  }

  pause() {
    this.isPlayingSubject.next(false);
    this.pauseSubject.next();
  }

  stop() {
    this.isPlayingSubject.next(false);
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

  jumpToRaceStart() {
    this.jumpToRaceStartSubject.next();
  }

  getIsPlaying(): boolean {
    return this.isPlayingSubject.value;
  }

  setRaceStartInfo(raceStartTime: Date, isFormationLap: boolean) {
    this.raceStartTimeSubject.next(raceStartTime);
    this.isFormationLapSubject.next(isFormationLap);
    this.raceStartDetectedSubject.next({ raceStartTime, isFormationLap });
  }

  getRaceStartTime(): Date | null {
    return this.raceStartTimeSubject.value;
  }

  getIsFormationLap(): boolean {
    return this.isFormationLapSubject.value;
  }

  // Car size scale API
  setCarSizeScale(scale: number) {
    const clamped = Math.min(3, Math.max(0.5, parseFloat(scale as any)));
    this.carSizeScaleSubject.next(Number(clamped.toFixed(2)));
  }

  adjustCarSizeScale(delta: number) {
    this.setCarSizeScale(this.getCarSizeScale() + delta);
  }

  getCarSizeScale(): number {
    return this.carSizeScaleSubject.value;
  }
}
