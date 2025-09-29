import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map, shareReplay, finalize } from 'rxjs/operators';
import { LoadingService } from './loading.service';

// Helper function to generate a random color
function getRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

@Injectable({
  providedIn: 'root'
})
export class Openf1ApiService {
  private baseUrl = 'https://api.openf1.org/v1';
  private cache = new Map<string, any>();
  private driverCache = new Map<string, Observable<any[]>>();
  private sessionKey: number = 9181;

  constructor(private http: HttpClient, private loadingService: LoadingService) { }

  setSessionKey(sessionKey: number) {
    if (this.sessionKey !== sessionKey) {
      this.sessionKey = sessionKey;
      this.cache.clear();
      this.driverCache.clear();
    }
  }

  getSessions(year: number): Observable<any[]> {
    const url = `${this.baseUrl}/sessions?year=${year}`;
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    this.loadingService.show();
    return this.http.get<any[]>(url).pipe(
      tap(data => this.cache.set(url, data)),
      finalize(() => this.loadingService.hide())
    );
  }

  getDriverFullTrajectory(driverNumber: number, startTime: string): Observable<any[]> {
    const url = `${this.baseUrl}/location?session_key=${this.sessionKey}&driver_number=${driverNumber}&date>${startTime}`;
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    this.loadingService.show();
    return this.http.get<any[]>(url).pipe(
      tap(data => this.cache.set(url, data)),
      finalize(() => this.loadingService.hide())
    );
  }

  getSessionInfo(): Observable<any> {
    const url = `${this.baseUrl}/sessions?session_key=${this.sessionKey}`;
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    this.loadingService.show();
    return this.http.get<any>(url).pipe(
      tap(data => this.cache.set(url, data)),
      finalize(() => this.loadingService.hide())
    );
  }

  getDrivers(): Observable<any[]> {
    const url = `${this.baseUrl}/drivers?session_key=${this.sessionKey}`;
    if (this.driverCache.has(url)) {
      return this.driverCache.get(url)!;
    }

    this.loadingService.show();
    const driversObservable = this.http.get<any[]>(url).pipe(
      map(drivers => drivers.map(driver => ({
        ...driver,
        car_color: driver.team_colour ? `#${driver.team_colour}` : getRandomColor()
      }))),
      shareReplay(1),
      finalize(() => this.loadingService.hide())
    );

    this.driverCache.set(url, driversObservable);
    return driversObservable;
  }
}
