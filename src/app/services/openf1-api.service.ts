import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { tap, map, shareReplay, finalize, switchMap } from 'rxjs/operators';
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
  
  // Dynamic loading properties
  private loadedDataSegments: Map<string, any[]> = new Map(); // key: "start-end", value: data
  private sessionStartTime: Date | null = null;
  private readonly CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

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
      this.loadedDataSegments.clear();
      this.sessionStartTime = null;
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

  /**
   * @deprecated Use getAllDriversLocationData() instead for better performance
   * This method makes individual calls per driver which is inefficient
   */
  getDriverFullTrajectory(driverNumber: number, startTime: string): Observable<any[]> {
    console.warn('⚠️ DEPRECATED: getDriverFullTrajectory() should be replaced with getAllDriversLocationData()');
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

  /**
   * @deprecated Use getAllDriversLocationData() instead for better performance
   * This method is no longer needed with the single API call approach
   */
  getAllDriversLocationBatch(startTime: string, endTime: string): Observable<any[]> {
    console.warn('⚠️ DEPRECATED: getAllDriversLocationBatch() should be replaced with getAllDriversLocationData()');
    const url = `${this.baseUrl}/location?session_key=${this.sessionKey}&date>${startTime}&date<${endTime}`;
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

  /**
   * Fetches location data for ALL drivers for the first 5 minutes of the session
   * This single call provides all the data needed to draw the track and simulate the race
   */
  getAllDriversLocationData(): Observable<any[]> {
    return this.getSessionTimeBounds().pipe(
      switchMap(({ startTime }) => {
        this.sessionStartTime = startTime;
        
        // Start by loading the first chunk
        return this.loadDataChunk(0);
      })
    );
  }

  /**
   * Loads a specific 5-minute chunk of data
   * @param chunkIndex 0 = first 5 minutes, 1 = next 5 minutes, etc.
   * @param showLoading Whether to show loading indicator (true for initial load, false for background loading)
   */
  loadDataChunk(chunkIndex: number, showLoading: boolean = true): Observable<any[]> {
    if (!this.sessionStartTime) {
      throw new Error('Session start time not available');
    }

    const chunkStartTime = new Date(this.sessionStartTime.getTime() + chunkIndex * this.CHUNK_DURATION_MS);
    const chunkEndTime = new Date(chunkStartTime.getTime() + this.CHUNK_DURATION_MS);
    
    const chunkKey = `${chunkIndex}`;
    
    // Check if this chunk is already loaded
    if (this.loadedDataSegments.has(chunkKey)) {
      console.log(`📦 Chunk ${chunkIndex} already loaded from memory`);
      return of(this.getCombinedLoadedData());
    }

    const startStr = chunkStartTime.toISOString();
    const endStr = chunkEndTime.toISOString();
    
    const url = `${this.baseUrl}/location?session_key=${this.sessionKey}&date%3E${encodeURIComponent(startStr)}&date%3C${encodeURIComponent(endStr)}`;
    
    if (showLoading) {
      console.log(`🚗 Loading chunk ${chunkIndex} (${chunkIndex * 5}-${(chunkIndex + 1) * 5} minutes):`);
    } else {
      console.log(`🔄 Background loading chunk ${chunkIndex} (${chunkIndex * 5}-${(chunkIndex + 1) * 5} minutes):`);
    }
    console.log('   📅 Chunk start:', startStr);
    console.log('   📅 Chunk end:', endStr);
    
    if (this.cache.has(url)) {
      console.log('📦 Chunk data loaded from cache');
      const chunkData = this.cache.get(url);
      this.loadedDataSegments.set(chunkKey, chunkData);
      return of(this.getCombinedLoadedData());
    }

    if (showLoading) {
      console.log('🌐 Fetching fresh chunk data from OpenF1 API...');
      this.loadingService.show();
    } else {
      console.log('🌐 Silently fetching chunk data in background...');
    }
    
    return this.http.get<any[]>(url).pipe(
      tap(chunkData => {
        const loadingText = showLoading ? 'Successfully loaded' : 'Background loaded';
        console.log(`✅ ${loadingText} chunk ${chunkIndex}: ${chunkData.length} location data points!`);
        this.cache.set(url, chunkData);
        this.loadedDataSegments.set(chunkKey, chunkData);
        sessionStorage.setItem('apiCache', JSON.stringify(Array.from(this.cache.entries())));
      }),
      map(() => this.getCombinedLoadedData()),
      finalize(() => {
        if (showLoading) {
          this.loadingService.hide();
        }
      })
    );
  }

  /**
   * Checks if more data should be loaded based on current simulation time
   * @param currentTime Current simulation time
   * @returns Observable that emits updated data if new chunk was loaded
   */
  checkAndLoadMoreData(currentTime: Date): Observable<any[]> {
    if (!this.sessionStartTime) {
      return of(this.getCombinedLoadedData());
    }

    const elapsedMs = currentTime.getTime() - this.sessionStartTime.getTime();
    const elapsedChunks = Math.floor(elapsedMs / this.CHUNK_DURATION_MS);
    const currentChunk = elapsedChunks;
    const progressInCurrentChunk = (elapsedMs % this.CHUNK_DURATION_MS) / this.CHUNK_DURATION_MS;

    // Load next chunk when we're 80% through the current chunk
    if (progressInCurrentChunk >= 0.8) {
      const nextChunk = currentChunk + 1;
      const nextChunkKey = `${nextChunk}`;
      
      if (!this.loadedDataSegments.has(nextChunkKey)) {
        console.log(`🔄 Simulation is 80% through chunk ${currentChunk}, loading next chunk ${nextChunk} in background...`);
        return this.loadDataChunk(nextChunk, false); // false = background loading without loading modal
      }
    }

    return of(this.getCombinedLoadedData());
  }

  /**
   * Combines all loaded data segments into a single array
   */
  private getCombinedLoadedData(): any[] {
    const allData: any[] = [];
    
    // Sort chunk keys to ensure chronological order
    const sortedKeys = Array.from(this.loadedDataSegments.keys())
      .map(key => parseInt(key))
      .sort((a, b) => a - b)
      .map(num => num.toString());

    for (const key of sortedKeys) {
      const chunkData = this.loadedDataSegments.get(key);
      if (chunkData) {
        allData.push(...chunkData);
      }
    }

    console.log(`📊 Combined data: ${allData.length} total points from ${this.loadedDataSegments.size} chunks`);
    return allData;
  }

  /**
   * Gets information about loaded data segments for debugging
   */
  getLoadedSegmentsInfo(): any {
    return {
      totalSegments: this.loadedDataSegments.size,
      segmentKeys: Array.from(this.loadedDataSegments.keys()),
      totalDataPoints: this.getCombinedLoadedData().length,
      sessionStartTime: this.sessionStartTime
    };
  }

  /**
   * Clears all loaded data segments (useful for restarting simulation)
   */
  clearLoadedSegments(): void {
    console.log('🧹 Clearing all loaded data segments');
    this.loadedDataSegments.clear();
    this.sessionStartTime = null;
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

  getSessionTimeBounds(): Observable<{startTime: Date, endTime: Date}> {
    return this.getSessionInfo().pipe(
      map(sessions => {
        const session = sessions[0];
        return {
          startTime: new Date(session.date_start),
          endTime: new Date(session.date_end)
        };
      })
    );
  }

  getPositionData(): Observable<any[]> {
    const url = `${this.baseUrl}/position?session_key=${this.sessionKey}`;
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
