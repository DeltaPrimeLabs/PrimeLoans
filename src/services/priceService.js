import {Subject} from 'rxjs';

export default class PriceService {
  refreshPrices$ = new Subject();

  emitRefreshPrices() {
    this.refreshPrices$.next(null);
  }

  observeRefreshPrices() {
    return this.refreshPrices$.asObservable();
  }
};