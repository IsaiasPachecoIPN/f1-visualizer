import { Component, OnInit } from '@angular/core';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { CommonModule } from '@angular/common';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-race-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './race-info.component.html',
})
export class RaceInfoComponent implements OnInit {
  sessionInfo$: Observable<any>;
  latestWeather$: Observable<any | null>;
  weatherMiniTimeline$: Observable<any[]>;
  
  constructor(private openf1ApiService: Openf1ApiService) {
    // Initialize observable in constructor to prevent multiple calls
    this.sessionInfo$ = this.openf1ApiService.getSessionInfo().pipe(map(data => data && data.length ? data[0] : null));

    const weather$ = this.openf1ApiService.getWeather();

    // Latest sample (closest to now)
    this.latestWeather$ = weather$.pipe(
      map(list => {
        if (!list || !list.length) return null;
        const now = Date.now();
        return [...list].sort((a,b) => Math.abs(new Date(a.date).getTime()-now) - Math.abs(new Date(b.date).getTime()-now))[0];
      })
    );

    // Mini timeline: take last 5 samples spaced (or all if <5)
    this.weatherMiniTimeline$ = weather$.pipe(
      map(list => {
        if (!list) return [];
        return list.slice(-5);
      })
    );
  }

  ngOnInit(): void {
    // No need to subscribe here - template will use async pipe
    console.log('📊 Race info component initialized');
  }
}
