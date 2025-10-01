import { Component, HostListener, computed, signal } from '@angular/core';
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
}
