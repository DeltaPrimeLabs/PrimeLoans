import {Subject} from 'rxjs';

export default class LpService {
  refreshLp$ = new Subject();

  emitRefreshLp() {
    this.refreshLp$.next(null);
  }

  observeRefreshLp() {
    return this.refreshLp$.asObservable();
  }
};