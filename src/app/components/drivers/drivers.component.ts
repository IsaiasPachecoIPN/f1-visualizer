import { Component, OnInit, signal, computed } from '@angular/core';
import { Openf1ApiService } from '../../services/openf1-api.service';
import { DriverVisibilityService } from '../../services/driver-visibility.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarComponent } from '../car/car.component';
import { ZardCheckboxComponent } from '@shared/components/checkbox/checkbox.component';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [CommonModule, FormsModule, CarComponent, ZardCheckboxComponent],
  templateUrl: './drivers.component.html',
})
export class DriversComponent implements OnInit {
  drivers: any[] = [];
  // Track visibility per driver number
  private visibleDriversSet = new Set<number>();
  allVisible = signal(true);

  visibleCount = computed(() => this.visibleDriversSet.size);

  constructor(private openf1ApiService: Openf1ApiService, private driverVisibility: DriverVisibilityService) {}

  ngOnInit(): void {
    this.openf1ApiService.getDrivers().subscribe(data => {
      this.drivers = data;
      // Initialize all visible
      this.visibleDriversSet = new Set<number>(data.map((d: any) => d.driver_number));
      this.allVisible.set(true);
  // seed driver visibility map
  this.drivers.forEach(d => (this._driverVisibility[d.driver_number] = true));
  this._allVisibleModel = true;
  this.driverVisibility.setDrivers(this.drivers.map(d => d.driver_number));
    });
  }

  isDriverVisible(driverNumber: number): boolean {
    return this.visibleDriversSet.has(driverNumber);
  }

  toggleDriver(driverNumber: number, checked: boolean) {
    if (checked) {
      this.visibleDriversSet.add(driverNumber);
    } else {
      this.visibleDriversSet.delete(driverNumber);
    }
  this.allVisible.set(this.visibleDriversSet.size === this.drivers.length);
  this.driverVisibility.setDriver(driverNumber, checked);
  }

  toggleAll(checked: boolean) {
    if (checked) {
      this.drivers.forEach(d => this.visibleDriversSet.add(d.driver_number));
    } else {
      this.visibleDriversSet.clear();
    }
  this.allVisible.set(checked);
  this._allVisibleModel = checked;
  this.drivers.forEach(d => (this._driverVisibility[d.driver_number] = checked));
  this.driverVisibility.setAll(checked);
  }

  // Backing models for template two-way binding
  _driverVisibility: Record<number, boolean> = {};
  _allVisibleModel = true;
}
