import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay, tap, finalize } from 'rxjs';

interface LapRecord {
  date_start: string;
  driver_number: number;
  lap_number: number;
  lap_duration?: number;
  st_speed?: number;
  duration_sector_1?: number;
  duration_sector_2?: number;
  duration_sector_3?: number;
  i1_speed?: number;
  i2_speed?: number;
  is_pit_out_lap?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LapDataService {
  private baseUrl = 'https://api.openf1.org/v1';
  private sessionKey: number | null = null;

  private readonly LAP_CHUNK_SIZE = 10; // numeric span per chunk (inclusive start, exclusive end)
  private loadedLapChunks = new Map<number, LapRecord[]>();
  private inFlightChunk = new Map<number, Observable<LapRecord[]>>();
  private combinedCache: LapRecord[] = [];

  /** Set session key (call on session change) */
  setSessionKey(key: number) {
    if (this.sessionKey !== key) {
      this.sessionKey = key;
      // Clear previous state
      this.loadedLapChunks.clear();
      this.inFlightChunk.clear();
      this.combinedCache = [];
    }
  }

  /** Returns all loaded lap data combined */
  getAllLoaded(): LapRecord[] { return this.combinedCache; }

  /** Maximum loaded lap number so far */
  getMaxLoadedLap(): number {
    if (this.combinedCache.length === 0) return 0;
    return this.combinedCache.reduce((m, r) => Math.max(m, r.lap_number), 0);
  }

  /** Load a chunk by index (0 => laps 1-10, 1 => 11-20, etc.) */
  loadLapDataChunk(chunkIndex: number): Observable<LapRecord[]> {
    if (this.sessionKey == null) return of([]);
    if (this.loadedLapChunks.has(chunkIndex)) {
      return of(this.getCombined());
    }
    if (this.inFlightChunk.has(chunkIndex)) {
      return this.inFlightChunk.get(chunkIndex)!;
    }

    const startLap = chunkIndex * this.LAP_CHUNK_SIZE + 1; // inclusive
    const endLapExclusive = startLap + this.LAP_CHUNK_SIZE; // exclusive
    // API supports lap_number> and lap_number< (encoded > as %3E)
    // We want laps >= startLap, < endLapExclusive => lap_number>(startLap-1)
    const greaterThanParam = startLap - 1;
    const url = `${this.baseUrl}/laps?session_key=${this.sessionKey}&lap_number%3E=${greaterThanParam}&lap_number%3C${endLapExclusive}`;

    const obs = this.http.get<LapRecord[]>(url).pipe(
      tap(data => {
        this.loadedLapChunks.set(chunkIndex, data);
        // Rebuild combined cache sorted by (lap_number, driver_number)
        this.combinedCache = Array.from(this.loadedLapChunks.entries())
          .sort((a, b) => a[0] - b[0])
          .flatMap(e => e[1])
          .sort((a, b) => a.lap_number - b.lap_number || a.driver_number - b.driver_number);
        console.log(`🟢 Loaded lap chunk ${chunkIndex}: laps ${startLap}-${endLapExclusive - 1} (${data.length} records)`);
      }),
      finalize(() => this.inFlightChunk.delete(chunkIndex)),
      shareReplay(1)
    );

    this.inFlightChunk.set(chunkIndex, obs);
    return obs;
  }

  /** Decide if next chunk should be prefetched based on current lap */
  shouldPreloadNextChunk(currentLap: number): boolean {
    if (currentLap <= 0) return false;
    const currentChunk = Math.floor((currentLap - 1) / this.LAP_CHUNK_SIZE);
    const chunkStart = currentChunk * this.LAP_CHUNK_SIZE + 1;
    const lapProgressInChunk = (currentLap - chunkStart + 1) / this.LAP_CHUNK_SIZE; // 0..1
    // Preload when 70% through current chunk
    return lapProgressInChunk >= 0.7 && !this.loadedLapChunks.has(currentChunk + 1) && !this.inFlightChunk.has(currentChunk + 1);
  }

  private getCombined(): LapRecord[] { return this.combinedCache; }

  constructor(private http: HttpClient) {}
}
