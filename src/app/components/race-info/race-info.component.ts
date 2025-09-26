import { Component, OnInit } from '@angular/core';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-race-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './race-info.component.html',
})
export class RaceInfoComponent implements OnInit {
  sessionInfo: any;
  private readonly SESSION_KEY = 9181; // Mexico City GP 2023

  constructor(private openf1ApiService: Openf1ApiService) {}

  ngOnInit(): void {
    this.openf1ApiService.getSessionInfo(this.SESSION_KEY).subscribe(data => {
      this.sessionInfo = data[0];
    });
  }
}
