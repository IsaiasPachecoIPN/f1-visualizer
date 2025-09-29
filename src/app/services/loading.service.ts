import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  public readonly loading = new BehaviorSubject<boolean>(false);

  show() {
    this.loading.next(true);
  }

  hide() {
    this.loading.next(false);
  }
}
