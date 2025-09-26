import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';

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

  constructor(private http: HttpClient) { }

  getDriverFullTrajectory(sessionKey: number, driverNumber: number, startTime: string): Observable<any[]> {
    const url = `${this.baseUrl}/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>${startTime}`;
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    return this.http.get<any[]>(url).pipe(
      tap(data => this.cache.set(url, data))
    );
  }

  getSessionInfo(sessionKey: number): Observable<any> {
    const url = `${this.baseUrl}/sessions?session_key=${sessionKey}`;
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    return this.http.get<any>(url).pipe(
      tap(data => this.cache.set(url, data))
    );
  }

  getDrivers(sessionKey: number): Observable<any[]> {
    const url = `${this.baseUrl}/drivers?session_key=${sessionKey}`;
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    return this.http.get<any[]>(url).pipe(
      map(drivers => drivers.map(driver => ({
        ...driver,
        car_color: getRandomColor()
      }))),
      tap(data => this.cache.set(url, data))
    );
  }
}
