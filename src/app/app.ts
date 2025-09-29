import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnimationComponent } from './components/animation/animation.component';
import { RaceInfoComponent } from './components/race-info/race-info.component';
import { DriversComponent } from './components/drivers/drivers.component';
import { ControlsComponent } from './components/controls/controls.component';
import { CommentsComponent } from './components/comments/comments.component';
import { TimeDisplayComponent } from './components/time-display/time-display.component';
import { PositionsComponent } from './components/positions/positions.component';
import { ZardBadgeComponent } from '@shared/components/badge/badge.component';
import { CommonModule } from '@angular/common';
import { LoadingComponent } from './components/loading/loading.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AnimationComponent, RaceInfoComponent, DriversComponent, ControlsComponent, CommentsComponent, TimeDisplayComponent, PositionsComponent, ZardBadgeComponent, CommonModule, LoadingComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('f1-visualizer');
}
