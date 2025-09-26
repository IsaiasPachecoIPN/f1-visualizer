import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnimationControlService {
  private startSubject = new Subject<void>();
  private pauseSubject = new Subject<void>();
  private stopSubject = new Subject<void>();
  private toggleShowAllDriversSubject = new Subject<void>();

  start$ = this.startSubject.asObservable();
  pause$ = this.pauseSubject.asObservable();
  stop$ = this.stopSubject.asObservable();
  toggleShowAllDrivers$ = this.toggleShowAllDriversSubject.asObservable();

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
}
