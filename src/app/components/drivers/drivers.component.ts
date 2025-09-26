import { Component, OnInit } from '@angular/core';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { CommonModule } from '@angular/common';
import { CarComponent } from '../car/car.component';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [CommonModule, CarComponent],
  templateUrl: './drivers.component.html',
})
export class DriversComponent implements OnInit {
  drivers: any[] = [];
  private readonly SESSION_KEY = 9181; // Mexico City GP 2023

  constructor(private openf1ApiService: Openf1ApiService) {}

  ngOnInit(): void {
    this.openf1ApiService.getDrivers(this.SESSION_KEY).subscribe(data => {
      this.drivers = data;
    });
  }
}
