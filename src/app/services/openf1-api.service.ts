import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { tap, map, shareReplay, finalize, switchMap, delay, concatMap } from 'rxjs/operators';
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

  // Rate limiting properties
  private lastRequestTime: number = 0;
  private requestQueue: Array<() => Observable<any>> = [];
  private readonly MIN_REQUEST_INTERVAL = 350; // 350ms between requests (allows ~2.8 requests/second, safely under 3/second)
  private isProcessingQueue = false;

  // Observable caching for sessions (to prevent multiple calls)
  private sessionsObservableCache = new Map<number, Observable<any[]>>();
  private sessionInfoObservableCache: Observable<any> | null = null;
  private weatherObservableCache: Observable<any[]> | null = null; // cache in-flight weather request per session

  // Dynamic loading properties
  private loadedDataSegments: Map<string, any[]> = new Map();
  private loadedCarDataSegments: Map<string, any[]> = new Map();
  private sessionStartTime: Date | null = null;
  private readonly CHUNK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private chunkObservableCache = new Map<string, Observable<any[]>>(); // in-flight chunk loads
  private carDataChunkObservableCache = new Map<string, Observable<any[]>>(); // in-flight car data chunk loads
  private loadingChunkKeys = new Set<string>();
  private loadingCarDataChunkKeys = new Set<string>();

  constructor(
    private http: HttpClient,
    private loadingService: LoadingService,
    private idb: IndexedDbCacheService
  ) {
    this.hydrateCaches();
  }

  /**
   * Rate-limited HTTP request wrapper
   * Ensures we don't exceed 3 requests per second by spacing requests at least 350ms apart
   */
  private makeRateLimitedRequest<T>(url: string): Observable<T> {
    return new Observable<T>(observer => {
      const requestFn = () => {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
          const delayTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
          console.log(`⏱️ Rate limiting: delaying request by ${delayTime}ms`);
          
          timer(delayTime).pipe(
            switchMap(() => {
              this.lastRequestTime = Date.now();
              return this.http.get<T>(url);
            })
          ).subscribe({
            next: (data) => observer.next(data),
            error: (error) => observer.error(error),
            complete: () => observer.complete()
          });
        } else {
          this.lastRequestTime = now;
          this.http.get<T>(url).subscribe({
            next: (data) => observer.next(data),
            error: (error) => observer.error(error),
            complete: () => observer.complete()
          });
        }
      };

      requestFn();
    });
  }

  /**
   * Queue-based rate limiting for multiple simultaneous requests
   * Processes requests one by one with proper spacing
   */
  private queueRequest<T>(requestFn: () => Observable<T>): Observable<T> {
    return new Observable<T>(observer => {
      this.requestQueue.push(() => requestFn().pipe(
        tap({
          next: (data) => observer.next(data),
          error: (error) => observer.error(error),
          complete: () => observer.complete()
        })
      ));

      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const processNext = () => {
      if (this.requestQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      const nextRequest = this.requestQueue.shift()!;
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const delayTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        console.log(`⏱️ Queue processing: delaying next request by ${delayTime}ms`);
        
        timer(delayTime).subscribe(() => {
          this.lastRequestTime = Date.now();
          nextRequest().subscribe({
            complete: () => processNext()
          });
        });
      } else {
        this.lastRequestTime = now;
        nextRequest().subscribe({
          complete: () => processNext()
        });
      }
    };

    processNext();
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
      this.loadedCarDataSegments.clear();
      this.sessionStartTime = null;
      this.idb.clearStore('apiCache');
      this.idb.clearStore('driverApiCache');
      this.idb.clearStore('halfRaceTrack');
      this.chunkObservableCache.clear();
      this.carDataChunkObservableCache.clear();
      this.loadingChunkKeys.clear();
      this.loadingCarDataChunkKeys.clear();
      // Clear session-specific observable caches
      this.sessionInfoObservableCache = null;
  this.weatherObservableCache = null;
    }
  }

  getSessions(year: number): Observable<any[]> {
    const url = `${this.baseUrl}/sessions?year=${year}`;
    
    // Check memory cache first
    if (this.cache.has(url)) {
      console.log('📦 Sessions loaded from memory cache');
      return of(this.cache.get(url));
    }

    // Check if there's already an in-flight request for this year
    if (this.sessionsObservableCache.has(year)) {
      console.log('⌛ Reusing in-flight sessions request');
      return this.sessionsObservableCache.get(year)!;
    }

    console.log(`🌐 Fetching sessions for year ${year} from OpenF1 API...`);
    this.loadingService.show();
    
    const sessionsObservable = this.makeRateLimitedRequest<any[]>(url).pipe(
      tap(data => {
        console.log(`✅ Successfully loaded ${data.length} sessions for year ${year}`);
        this.cache.set(url, data);
        this.persistApiCache();
      }),
      finalize(() => {
        this.loadingService.hide();
        this.sessionsObservableCache.delete(year);
      }),
      shareReplay(1)
    );

    this.sessionsObservableCache.set(year, sessionsObservable);
    return sessionsObservable;
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
    return this.makeRateLimitedRequest<any[]>(url).pipe(
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
    return this.makeRateLimitedRequest<any[]>(url).pipe(
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
    
    const obs = this.makeRateLimitedRequest<any[]>(url).pipe(
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
    this.loadedCarDataSegments.clear();
    this.sessionStartTime = null;
  this.chunkObservableCache.clear();
  this.carDataChunkObservableCache.clear();
  this.loadingChunkKeys.clear();
  this.loadingCarDataChunkKeys.clear();
  }

  /**
   * Fetches car data for ALL drivers for the first 5 minutes of the session
   * This single call provides all the car telemetry data needed for the simulation
   */
  getAllDriversCarData(): Observable<any[]> {
    return this.getSessionTimeBounds().pipe(
      switchMap(({ startTime }) => {
        this.sessionStartTime = startTime;
        
        // Start by loading the first chunk of car data
        return this.loadCarDataChunk(0);
      })
    );
  }

  /**
   * Loads a specific 5-minute chunk of car data
   * @param chunkIndex 0 = first 5 minutes, 1 = next 5 minutes, etc.
   * @param showLoading Whether to show loading indicator (true for initial load, false for background loading)
   */
  loadCarDataChunk(chunkIndex: number, showLoading: boolean = true): Observable<any[]> {
    if (!this.sessionStartTime) {
      throw new Error('Session start time not available');
    }

    const chunkStartTime = new Date(this.sessionStartTime.getTime() + chunkIndex * this.CHUNK_DURATION_MS);
    const chunkEndTime = new Date(chunkStartTime.getTime() + this.CHUNK_DURATION_MS);
    
    const chunkKey = `car_${chunkIndex}`;
    
    // Check if this chunk is already loaded
    if (this.loadedCarDataSegments.has(chunkKey)) {
      console.log(`🚗 Car data chunk ${chunkIndex} already loaded from memory`);
      return of(this.getCombinedLoadedCarData());
    }

    // If there's an in-flight observable for this chunk, reuse it
    if (this.carDataChunkObservableCache.has(chunkKey)) {
      console.log(`⌛ Reusing in-flight car data chunk request ${chunkIndex}`);
      return this.carDataChunkObservableCache.get(chunkKey)!;
    }

    const startStr = chunkStartTime.toISOString();
    const endStr = chunkEndTime.toISOString();
    
    const url = `${this.baseUrl}/car_data?session_key=${this.sessionKey}&date%3E${encodeURIComponent(startStr)}&date%3C${encodeURIComponent(endStr)}`;
    
    if (showLoading) {
      console.log(`🚗 Loading car data chunk ${chunkIndex} (${chunkIndex * 5}-${(chunkIndex + 1) * 5} minutes):`);
    } else {
      console.log(`🔄 Background loading car data chunk ${chunkIndex} (${chunkIndex * 5}-${(chunkIndex + 1) * 5} minutes):`);
    }
    console.log('   📅 Chunk start:', startStr);
    console.log('   📅 Chunk end:', endStr);
    
    if (this.cache.has(url)) {
      console.log('📦 Car data chunk loaded from cache');
      const chunkData = this.cache.get(url);
      this.loadedCarDataSegments.set(chunkKey, chunkData);
      return of(this.getCombinedLoadedCarData());
    }

    if (showLoading) {
      console.log('🌐 Fetching fresh car data chunk from OpenF1 API...');
      this.loadingService.show();
    } else {
      console.log('🌐 Silently fetching car data chunk in background...');
    }
    
    const obs = this.makeRateLimitedRequest<any[]>(url).pipe(
      tap(chunkData => {
        const loadingText = showLoading ? 'Successfully loaded' : 'Background loaded';
        console.log(`✅ ${loadingText} car data chunk ${chunkIndex}: ${chunkData.length} car data points!`);
        this.cache.set(url, chunkData);
        this.loadedCarDataSegments.set(chunkKey, chunkData);
        this.persistApiCache();
      }),
      map(() => this.getCombinedLoadedCarData()),
      finalize(() => {
        if (showLoading) {
          this.loadingService.hide();
        }
        this.carDataChunkObservableCache.delete(chunkKey);
        this.loadingCarDataChunkKeys.delete(chunkKey);
      }),
      shareReplay(1)
    );

    this.carDataChunkObservableCache.set(chunkKey, obs);
    this.loadingCarDataChunkKeys.add(chunkKey);
    return obs;
  }

  /**
   * Checks if more car data should be loaded based on current simulation time
   * @param currentTime Current simulation time
   * @returns Observable that emits updated car data if new chunk was loaded
   */
  checkAndLoadMoreCarData(currentTime: Date): Observable<any[]> {
    if (!this.sessionStartTime) {
      return of(this.getCombinedLoadedCarData());
    }

    const elapsedMs = currentTime.getTime() - this.sessionStartTime.getTime();
    const elapsedChunks = Math.floor(elapsedMs / this.CHUNK_DURATION_MS);
    const currentChunk = elapsedChunks;
    const progressInCurrentChunk = (elapsedMs % this.CHUNK_DURATION_MS) / this.CHUNK_DURATION_MS;

    // Load next chunk when we're 80% through the current chunk
    if (progressInCurrentChunk >= 0.8) {
      const nextChunk = currentChunk + 1;
      const nextChunkKey = `car_${nextChunk}`;
      
      if (!this.loadedCarDataSegments.has(nextChunkKey) && !this.loadingCarDataChunkKeys.has(nextChunkKey)) {
        console.log(`🔄 Simulation is 80% through chunk ${currentChunk}, loading next car data chunk ${nextChunk} in background...`);
        return this.loadCarDataChunk(nextChunk, false); // false = background loading without loading modal
      } else if (this.carDataChunkObservableCache.has(nextChunkKey)) {
        return this.carDataChunkObservableCache.get(nextChunkKey)!;
      }
    }

    return of(this.getCombinedLoadedCarData());
  }

  /**
   * Combines all loaded car data segments into a single array
   */
  private getCombinedLoadedCarData(): any[] {
    const allData: any[] = [];
    
    // Sort chunk keys to ensure chronological order
    const sortedKeys = Array.from(this.loadedCarDataSegments.keys())
      .map(key => key.replace('car_', ''))
      .map(key => parseInt(key))
      .sort((a, b) => a - b)
      .map(num => `car_${num}`);

    for (const key of sortedKeys) {
      const chunkData = this.loadedCarDataSegments.get(key);
      if (chunkData) {
        allData.push(...chunkData);
      }
    }

    console.log(`🚗 Combined car data: ${allData.length} total points from ${this.loadedCarDataSegments.size} chunks`);
    return allData;
  }

  /**
   * Gets car data for a specific driver at a specific time
   * @param driverNumber Driver number
   * @param currentTime Current simulation time
   * @param timeWindow Time window to search within (in milliseconds)
   */
  getDriverCarDataAtTime(driverNumber: number, currentTime: Date, timeWindow: number = 5000): any | null {
    const allCarData = this.getCombinedLoadedCarData();
    const currentTimestamp = currentTime.getTime();

    // Find car data for the specific driver within the time window
    const driverCarData = allCarData
      .filter(data => data.driver_number === driverNumber)
      .filter(data => {
        const dataTime = new Date(data.date).getTime();
        return Math.abs(dataTime - currentTimestamp) <= timeWindow;
      })
      .sort((a, b) => Math.abs(new Date(a.date).getTime() - currentTimestamp) - Math.abs(new Date(b.date).getTime() - currentTimestamp));

    return driverCarData.length > 0 ? driverCarData[0] : null;
  }

  /**
   * Gets information about loaded car data segments for debugging
   */
  getLoadedCarDataSegmentsInfo(): any {
    return {
      totalSegments: this.loadedCarDataSegments.size,
      segmentKeys: Array.from(this.loadedCarDataSegments.keys()),
      totalDataPoints: this.getCombinedLoadedCarData().length,
      sessionStartTime: this.sessionStartTime
    };
  }

  getSessionInfo(): Observable<any> {
    const url = `${this.baseUrl}/sessions?session_key=${this.sessionKey}`;
    
    // Check memory cache first
    if (this.cache.has(url)) {
      console.log('📦 Session info loaded from memory cache');
      return of(this.cache.get(url));
    }

    // Check if there's already an in-flight request for this session
    if (this.sessionInfoObservableCache) {
      console.log('⌛ Reusing in-flight session info request');
      return this.sessionInfoObservableCache;
    }

    console.log(`🌐 Fetching session info for session ${this.sessionKey} from OpenF1 API...`);
    this.loadingService.show();
    
    this.sessionInfoObservableCache = this.makeRateLimitedRequest<any>(url).pipe(
      tap(data => {
        console.log(`✅ Successfully loaded session info for session ${this.sessionKey}`);
        this.cache.set(url, data);
        this.persistApiCache();
      }),
      finalize(() => {
        this.loadingService.hide();
        this.sessionInfoObservableCache = null;
      }),
      shareReplay(1)
    );

    return this.sessionInfoObservableCache;
  }

  /**
   * Fetch weather timeline for the current session.
   * Returns an array of samples ordered by time (API already returns chronological order; we sort defensively).
   * Cached in memory + IndexedDB (generic api cache) using the URL as key.
   * Uses shareReplay so multiple subscribers don't trigger extra HTTP calls.
   */
  getWeather(): Observable<any[]> {
    const url = `${this.baseUrl}/weather?session_key=${this.sessionKey}`;

    // Memory cache hit
    if (this.cache.has(url)) {
      return of(this.cache.get(url));
    }

    // In-flight observable reuse
    if (this.weatherObservableCache) {
      return this.weatherObservableCache;
    }

    // Light weight loading indicator (avoid blocking global loader if session info already showing)
    this.loadingService.show();
    this.weatherObservableCache = this.makeRateLimitedRequest<any[]>(url).pipe(
      map(data => Array.isArray(data) ? [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : []),
      tap(sorted => {
        this.cache.set(url, sorted);
        this.persistApiCache();
      }),
      finalize(() => {
        this.loadingService.hide();
        // keep observable for replay but allow new fetch after some minutes if needed (optional TTL could be added)
        this.weatherObservableCache = null;
      }),
      shareReplay(1)
    );

    return this.weatherObservableCache;
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
    return this.makeRateLimitedRequest<any[]>(url).pipe(
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
    const driversObservable = this.makeRateLimitedRequest<any[]>(url).pipe(
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
   * Detects the actual race start time by analyzing position changes and speed data
   * Formation lap typically has slower speeds and less position changes
   * Race start is detected when there's significant speed increase and position volatility
   */
  detectRaceStart(): Observable<{ raceStartTime: Date, isFormationLap: boolean }> {
    return this.getSessionTimeBounds().pipe(
      switchMap(({ startTime }) => {
        // Get position data for the first 10 minutes to analyze race start patterns
        const endTime = new Date(startTime.getTime() + 10 * 60 * 1000);
        const posUrl = `${this.baseUrl}/position?session_key=${this.sessionKey}&date%3E${encodeURIComponent(startTime.toISOString())}&date%3C${encodeURIComponent(endTime.toISOString())}`;
        
        return this.makeRateLimitedRequest<any[]>(posUrl).pipe(
          map(positions => {
            if (!positions || positions.length === 0) {
              return { raceStartTime: startTime, isFormationLap: false };
            }

            // Sort by time
            const sortedPositions = positions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            // Analyze position volatility in 30-second windows
            const windowSize = 30000; // 30 seconds
            let maxVolatility = 0;
            let raceStartTime = startTime;
            let currentTime = startTime.getTime();
            const endAnalysisTime = startTime.getTime() + 8 * 60 * 1000; // Analyze first 8 minutes

            while (currentTime < endAnalysisTime) {
              const windowStart = currentTime;
              const windowEnd = currentTime + windowSize;
              
              // Get positions in this window
              const windowPositions = sortedPositions.filter(pos => {
                const posTime = new Date(pos.date).getTime();
                return posTime >= windowStart && posTime <= windowEnd;
              });

              if (windowPositions.length > 10) { // Enough data points
                // Calculate position volatility (how much positions change)
                const positionChanges = this.calculatePositionVolatility(windowPositions);
                
                // Race start typically has high volatility (lots of position changes)
                if (positionChanges > maxVolatility) {
                  maxVolatility = positionChanges;
                  raceStartTime = new Date(windowStart + windowSize / 2); // Middle of window
                }
              }

              currentTime += 15000; // Move window by 15 seconds
            }

            // If we found significant volatility after the initial period, that's likely race start
            const timeSinceStart = raceStartTime.getTime() - startTime.getTime();
            const isFormationLap = timeSinceStart > 60000; // More than 1 minute suggests formation lap

            console.log(`🏁 Race start detection: ${isFormationLap ? 'Formation lap detected' : 'Direct race start'}`);
            console.log(`🏁 Detected race start time: ${raceStartTime.toISOString()}`);

            return { raceStartTime, isFormationLap };
          })
        );
      })
    );
  }

  /**
   * Calculate position volatility in a time window
   */
  private calculatePositionVolatility(positions: any[]): number {
    const positionsByDriver = new Map<number, number[]>();
    
    // Group positions by driver
    positions.forEach(pos => {
      if (!positionsByDriver.has(pos.driver_number)) {
        positionsByDriver.set(pos.driver_number, []);
      }
      positionsByDriver.get(pos.driver_number)!.push(pos.position);
    });

    // Calculate average position change per driver
    let totalVolatility = 0;
    let driverCount = 0;

    positionsByDriver.forEach(driverPositions => {
      if (driverPositions.length > 1) {
        const changes = driverPositions.slice(1).map((pos, i) => Math.abs(pos - driverPositions[i]));
        const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
        totalVolatility += avgChange;
        driverCount++;
      }
    });

    return driverCount > 0 ? totalVolatility / driverCount : 0;
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
            return this.makeRateLimitedRequest<any[]>(url).pipe(
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
