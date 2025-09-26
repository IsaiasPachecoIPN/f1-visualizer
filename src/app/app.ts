import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnimationComponent } from './components/animation/animation.component';
import { RaceInfoComponent } from './components/race-info/race-info.component';
import { DriversComponent } from './components/drivers/drivers.component';
import { ControlsComponent } from './components/controls/controls.component';
import { CommentsComponent } from './components/comments/comments.component';
import { ZardBadgeComponent } from '@shared/components/badge/badge.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AnimationComponent, RaceInfoComponent, DriversComponent, ControlsComponent, CommentsComponent, ZardBadgeComponent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('f1-visualizer');
}
