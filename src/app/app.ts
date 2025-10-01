import { Component, HostListener, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CAR_SVG } from './shared/utils/car-model';
import { RouterOutlet } from '@angular/router';
import { AnimationComponent } from './components/animation/animation.component';
import { RaceInfoComponent } from './components/race-info/race-info.component';
import { DriversComponent } from './components/drivers/drivers.component';
import { ControlsComponent } from './components/controls/controls.component';
import { CommentsComponent } from './components/comments/comments.component';
import { PositionsComponent } from './components/positions/positions.component';
import { ZardBadgeComponent } from '@shared/components/badge/badge.component';
import { ZardButtonComponent } from '@shared/components/button/button.component';
import { ZardAccordionComponent } from '@shared/components/accordion/accordion.component';
import { ZardAccordionItemComponent } from '@shared/components/accordion/accordion-item.component';
import { ZardCardComponent } from '@shared/components/card/card.component';
import { CommonModule } from '@angular/common';
import { LoadingComponent } from './components/loading/loading.component';
import { AnimationControlService } from './services/animation-control.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    AnimationComponent,
    RaceInfoComponent,
    DriversComponent,
    ControlsComponent,
    CommentsComponent,
    PositionsComponent,
    ZardBadgeComponent,
    CommonModule,
    LoadingComponent,
    ZardButtonComponent,
    ZardAccordionComponent,
    ZardAccordionItemComponent,
    ZardCardComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('f1-visualizer');

  // Drawer (dialog) state
  drawerOpen = signal(false);
  viewportWidth = signal(window.innerWidth);
  isTablet = computed(() => this.viewportWidth() <= 1024 && this.viewportWidth() > 640);
  isMobile = computed(() => this.viewportWidth() <= 640);
  useDrawer = computed(() => this.isTablet() || this.isMobile());
  hudDetach = computed(() => this.viewportWidth() < 1706);

  // Help modal state
  helpOpen = signal(false);

  constructor(private animationControl: AnimationControlService, private sanitizer: DomSanitizer) {}
  carSizeScale = signal(1);
  private syncCarSizeSub?: any;
  ngOnInit() {
    this.carSizeScale.set(this.animationControl.getCarSizeScale());
    this.syncCarSizeSub = this.animationControl.carSizeScale$.subscribe(v => this.carSizeScale.set(v));
  }
  get sanitizedCarSvg(): SafeHtml {
    // Scale via wrapping container; do not alter intrinsic SVG viewBox
    return this.sanitizer.bypassSecurityTrustHtml(CAR_SVG);
  }
  openHelp() { this.helpOpen.set(true); }
  closeHelp() { this.helpOpen.set(false); }
  toggleHelp() { this.helpOpen.update(v => !v); }

  toggleDrawer() {
    if (!this.useDrawer()) return;
    this.drawerOpen.update(v => !v);
  }

  closeDrawer() {
    if (this.drawerOpen()) this.drawerOpen.set(false);
  }

  increaseCarSize() { this.animationControl.adjustCarSizeScale(0.1); }
  decreaseCarSize() { this.animationControl.adjustCarSizeScale(-0.1); }
  carPreviewSize(): number { return Math.round(24 * this.carSizeScale()); }

  @HostListener('window:resize')
  onResize() {
    this.viewportWidth.set(window.innerWidth);
    // Auto close if switching to desktop
    if (!this.useDrawer()) this.drawerOpen.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.helpOpen()) {
      this.closeHelp();
    }
  }

  ngOnDestroy() { if (this.syncCarSizeSub) this.syncCarSizeSub.unsubscribe(); }
}
