import {Subject} from 'rxjs';

export default class FarmService {
  refreshFarm$ = new Subject();

  emitRefreshFarm() {
    this.refreshFarm$.next(null);
  }

  observeRefreshFarm() {
    return this.refreshFarm$.asObservable();
  }
};