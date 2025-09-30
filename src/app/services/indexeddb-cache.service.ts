import { Injectable } from '@angular/core';

interface IDBConfig {
  name: string;
  version: number;
  stores: string[];
}

@Injectable({ providedIn: 'root' })
export class IndexedDbCacheService {
  private db: IDBDatabase | null = null;
  private config: IDBConfig = {
    name: 'f1VisualizerCache',
    version: 1,
    stores: ['apiCache', 'driverApiCache', 'halfRaceTrack']
  };
  private opening: Promise<IDBDatabase> | null = null;

  private ensureDb(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);
    if (this.opening) return this.opening;

    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.config.name, this.config.version);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.config.stores.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        });
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.db.onclose = () => { this.db = null; };
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });

    return this.opening;
  }

  async get<T = any>(store: string, key: string): Promise<T | undefined> {
    try {
      const db = await this.ensureDb();
      return await new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const os = tx.objectStore(store);
        const req = os.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return undefined; // Fallback silently
    }
  }

  async set(store: string, key: string, value: any): Promise<void> {
    try {
      const db = await this.ensureDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        const req = os.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // ignore
    }
  }

  async clearStore(store: string): Promise<void> {
    try {
      const db = await this.ensureDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        const req = os.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // ignore
    }
  }

  async clearAll(): Promise<void> {
    await Promise.all(this.config.stores.map(s => this.clearStore(s)));
  }
}
