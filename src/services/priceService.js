import {BehaviorSubject, Subject} from 'rxjs';
import config from "../config";

export default class PriceService {
  prices$ = new BehaviorSubject({});
  refreshPrices$ = new Subject();

  setupPrices(redstonePriceData) {
    const prices = {}
    Object.keys(redstonePriceData).forEach(asset => {
      prices[asset] = redstonePriceData[asset][0].dataPoints[0].value
    });
    console.log('pricesService', prices);
    this.prices$.next(prices);
  }

  emitRefreshPrices() {
    this.refreshPrices$.next(null);
  }

  observeRefreshPrices() {
    return this.refreshPrices$.asObservable();
  }

  observePrices() {
    return this.prices$.asObservable();
  }

  async fetchPrices() {
    const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
    return await redstonePriceDataRequest.json()
  }
};
