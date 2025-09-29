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
  private cache: Map<string, any>;
  private driverDataCache: Map<string, any[]>;
  private driverObservableCache = new Map<string, Observable<any[]>>();
  private sessionKey: number = 9181;

  constructor(private http: HttpClient, private loadingService: LoadingService) {
    this.cache = new Map(JSON.parse(sessionStorage.getItem('apiCache') || '[]'));
    this.driverDataCache = new Map(JSON.parse(sessionStorage.getItem('driverApiCache') || '[]'));
  }

  setSessionKey(sessionKey: number) {
    if (this.sessionKey !== sessionKey) {
      this.sessionKey = sessionKey;
      this.cache.clear();
      this.driverDataCache.clear();
      this.driverObservableCache.clear();
      sessionStorage.removeItem('apiCache');
      sessionStorage.removeItem('driverApiCache');
    }
  }

  getSessions(year: number): Observable<any[]> {
    const url = `${this.baseUrl}/sessions?year=${year}`;
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    this.loadingService.show();
    return this.http.get<any[]>(url).pipe(
      tap(data => {
        this.cache.set(url, data);
        sessionStorage.setItem('apiCache', JSON.stringify(Array.from(this.cache.entries())));
      }),
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
      tap(data => {
        this.cache.set(url, data);
        sessionStorage.setItem('apiCache', JSON.stringify(Array.from(this.cache.entries())));
      }),
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
      tap(data => {
        this.cache.set(url, data);
        sessionStorage.setItem('apiCache', JSON.stringify(Array.from(this.cache.entries())));
      }),
      finalize(() => this.loadingService.hide())
    );
  }

  getDrivers(): Observable<any[]> {
    const url = `${this.baseUrl}/drivers?session_key=${this.sessionKey}`;
    if (this.driverDataCache.has(url)) {
      return of(this.driverDataCache.get(url)!);
    }

    if (this.driverObservableCache.has(url)) {
      return this.driverObservableCache.get(url)!;
    }

    this.loadingService.show();
    const driversObservable = this.http.get<any[]>(url).pipe(
      map(drivers => drivers.map(driver => ({
        ...driver,
        car_color: driver.team_colour ? `#${driver.team_colour}` : getRandomColor()
      }))),
      tap(data => {
        this.driverDataCache.set(url, data);
        sessionStorage.setItem('driverApiCache', JSON.stringify(Array.from(this.driverDataCache.entries())));
        this.driverObservableCache.delete(url);
      }),
      shareReplay(1),
      finalize(() => this.loadingService.hide())
    );

    this.driverObservableCache.set(url, driversObservable);
    return driversObservable;
  }
}
