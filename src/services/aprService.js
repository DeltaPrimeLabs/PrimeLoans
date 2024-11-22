import {Subject} from 'rxjs';

export default class AprService {
  refreshApr$ = new Subject();

  emitRefreshApr() {
    this.refreshApr$.next(null);
  }

  observeRefreshApr() {
    return this.refreshApr$.asObservable();
  }
};