import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DriverVisibilityService {
  private state$ = new BehaviorSubject<Record<number, boolean>>({});
  visibility$ = this.state$.asObservable();

  setDrivers(numbers: number[]) {
    const current = { ...this.state$.value };
    let changed = false;
    numbers.forEach(n => { if (!(n in current)) { current[n] = true; changed = true; } });
    if (changed) this.state$.next(current);
  }

  setDriver(number: number, visible: boolean) {
    const current = { ...this.state$.value };
    if (current[number] !== visible) { current[number] = visible; this.state$.next(current); }
  }

  setAll(visible: boolean) {
    const current = { ...this.state$.value };
    let changed = false;
    Object.keys(current).forEach(k => { const n = +k; if (current[n] !== visible) { current[n] = visible; changed = true; } });
    if (changed) this.state$.next(current);
  }

  isVisible(number: number): boolean { return this.state$.value[number] !== false; }
}
