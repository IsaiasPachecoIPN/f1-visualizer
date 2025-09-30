import { Component, OnInit } from '@angular/core';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-race-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './race-info.component.html',
})
export class RaceInfoComponent implements OnInit {
  sessionInfo$: Observable<any>;
  
  constructor(private openf1ApiService: Openf1ApiService) {
    // Initialize observable in constructor to prevent multiple calls
    this.sessionInfo$ = this.openf1ApiService.getSessionInfo().pipe(
      map(data => data && data.length ? data[0] : null)
    );
  }

  ngOnInit(): void {
    // No need to subscribe here - template will use async pipe
    console.log('📊 Race info component initialized');
  }
}
