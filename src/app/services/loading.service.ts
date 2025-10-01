import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  public readonly loading = new BehaviorSubject<boolean>(false);
  private activeBlocks = new Set<string>();
  private LEGACY_KEY = '__legacy__';

  /** Legacy simple show (kept for backward compatibility). */
  show() { this.startBlock(this.LEGACY_KEY); }
  /** Legacy simple hide (kept for backward compatibility). */
  hide() { this.endBlock(this.LEGACY_KEY); }

  /** Start a named loading block. Overlay stays until all blocks end. */
  startBlock(id: string) {
    if (!id) id = this.LEGACY_KEY;
    this.activeBlocks.add(id);
    this.emitState();
  }

  /** End a named loading block. */
  endBlock(id: string) {
    if (!id) id = this.LEGACY_KEY;
    this.activeBlocks.delete(id);
    this.emitState();
  }

  /** Force clear all blocks (failsafe). */
  clearAll() {
    this.activeBlocks.clear();
    this.emitState();
  }

  private emitState() {
    const isLoading = this.activeBlocks.size > 0;
    if (this.loading.value !== isLoading) {
      this.loading.next(isLoading);
    }
  }
}
