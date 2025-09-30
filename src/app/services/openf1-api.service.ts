import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map, shareReplay, finalize, switchMap } from 'rxjs/operators';
import { LoadingService } from './loading.service';
import { IndexedDbCacheService } from './indexeddb-cache.service';

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
  private cache: Map<string, any> = new Map();
  private driverDataCache: Map<string, any[]> = new Map();
  private driverObservableCache = new Map<string, Observable<any[]>>();
  private sessionKey: number = 9181;
  private halfRaceTrackCacheKeyPrefix = 'halfRaceTrack';

  // Dynamic loading properties
  private loadedDataSegments: Map<string, any[]> = new Map();
  private sessionStartTime: Date | null = null;
  private readonly CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private chunkObservableCache = new Map<string, Observable<any[]>>(); // in-flight chunk loads
  private loadingChunkKeys = new Set<string>();

  constructor(
    private http: HttpClient,
    private loadingService: LoadingService,
    private idb: IndexedDbCacheService
  ) {
    this.hydrateCaches();
  }

  private async hydrateCaches() {
    try {
      const apiEntries = await this.idb.get<[string, any][]>('apiCache', 'entries');
      if (apiEntries) this.cache = new Map(apiEntries);
      const driverEntries = await this.idb.get<[string, any][]>('driverApiCache', 'entries');
      if (driverEntries) this.driverDataCache = new Map(driverEntries);
    } catch {
      // ignore hydration errors
    }
  }

  private persistApiCache() {
    this.idb.set('apiCache', 'entries', Array.from(this.cache.entries()));
  }

  private persistDriverCache() {
    this.idb.set('driverApiCache', 'entries', Array.from(this.driverDataCache.entries()));
  }

  setSessionKey(sessionKey: number) {
    if (this.sessionKey !== sessionKey) {
      this.sessionKey = sessionKey;
      this.cache.clear();
      this.driverDataCache.clear();
      this.driverObservableCache.clear();
      this.loadedDataSegments.clear();
      this.sessionStartTime = null;
      this.idb.clearStore('apiCache');
      this.idb.clearStore('driverApiCache');
      this.idb.clearStore('halfRaceTrack');
  this.chunkObservableCache.clear();
  this.loadingChunkKeys.clear();
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
  this.persistApiCache();
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
  this.persistApiCache();
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
          this.persistApiCache();
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

    // If there's an in-flight observable for this chunk, reuse it
    if (this.chunkObservableCache.has(chunkKey)) {
      console.log(`⌛ Reusing in-flight chunk request ${chunkIndex}`);
      return this.chunkObservableCache.get(chunkKey)!;
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
    
    const obs = this.http.get<any[]>(url).pipe(
      tap(chunkData => {
        const loadingText = showLoading ? 'Successfully loaded' : 'Background loaded';
        console.log(`✅ ${loadingText} chunk ${chunkIndex}: ${chunkData.length} location data points!`);
        this.cache.set(url, chunkData);
        this.loadedDataSegments.set(chunkKey, chunkData);
        this.persistApiCache();
      }),
      map(() => this.getCombinedLoadedData()),
      finalize(() => {
        if (showLoading) {
          this.loadingService.hide();
        }
        this.chunkObservableCache.delete(chunkKey);
        this.loadingChunkKeys.delete(chunkKey);
      }),
      shareReplay(1)
    );

    this.chunkObservableCache.set(chunkKey, obs);
    this.loadingChunkKeys.add(chunkKey);
    return obs;
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
      
      if (!this.loadedDataSegments.has(nextChunkKey) && !this.loadingChunkKeys.has(nextChunkKey)) {
        console.log(`🔄 Simulation is 80% through chunk ${currentChunk}, loading next chunk ${nextChunk} in background...`);
        return this.loadDataChunk(nextChunk, false); // false = background loading without loading modal
      } else if (this.chunkObservableCache.has(nextChunkKey)) {
        return this.chunkObservableCache.get(nextChunkKey)!;
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
  this.chunkObservableCache.clear();
  this.loadingChunkKeys.clear();
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
  this.persistApiCache();
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
  this.persistApiCache();
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
  car_color: driver.team_colour ? `#${driver.team_colour}` : getRandomColor(),
  headshot_url: driver.headshot_url ? driver.headshot_url : 'not_found_driver.png'
      }))),
      tap(data => {
  this.driverDataCache.set(url, data);
  this.persistDriverCache();
        this.driverObservableCache.delete(url);
      }),
      shareReplay(1),
      finalize(() => this.loadingService.hide())
    );

    this.driverObservableCache.set(url, driversObservable);
    return driversObservable;
  }

  /**
   * Fetches only the first HALF of the race location data for a single driver.
   * This is used exclusively to build a full track outline while minimizing data volume.
   * Result is cached in sessionStorage so it's fetched only once per session & driver.
   * @param driverNumber Driver number to use for track outline (e.g. 1)
   */
  getHalfRaceTrackDriverData(driverNumber: number): Observable<any[]> {
    const cacheKey = `${this.halfRaceTrackCacheKeyPrefix}_${this.sessionKey}_${driverNumber}`;
    return new Observable<any[]>(observer => {
      this.idb.get<any[]>('halfRaceTrack', cacheKey).then((stored: any[] | undefined) => {
        if (stored) {
          observer.next(stored);
          observer.complete();
          return;
        }

        this.getSessionTimeBounds().pipe(
          switchMap(({ startTime, endTime }) => {
            const halfTime = new Date(startTime.getTime() + (endTime.getTime() - startTime.getTime()) / 2);
            const startStr = startTime.toISOString();
            const halfStr = halfTime.toISOString();
            const url = `${this.baseUrl}/location?session_key=${this.sessionKey}&driver_number=${driverNumber}&date%3E${encodeURIComponent(startStr)}&date%3C${encodeURIComponent(halfStr)}`;

            if (this.cache.has(url)) {
              const data = this.cache.get(url);
              this.idb.set('halfRaceTrack', cacheKey, data);
              observer.next(data);
              observer.complete();
              return of([]);
            }

            this.loadingService.show();
            return this.http.get<any[]>(url).pipe(
              tap(data => {
                this.cache.set(url, data);
                this.persistApiCache();
                this.idb.set('halfRaceTrack', cacheKey, data);
                console.log(`🛣️ Loaded half-race track trajectory for driver ${driverNumber}: ${data.length} points`);
              }),
              finalize(() => this.loadingService.hide())
            );
          })
        ).subscribe(apiData => {
          if (Array.isArray(apiData) && apiData.length) {
            observer.next(apiData);
          }
          observer.complete();
        });
      });
    });
  }
}
