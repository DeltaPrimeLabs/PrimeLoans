import {Subject} from 'rxjs';

export default class DataRefreshEventService {

  assetBalancesDataRefreshEvent$ = new Subject();
  debtsPerAssetDataRefreshEvent$ = new Subject();
  hardRefreshScheduledEvent$ = new Subject();

  emitAssetBalancesDataRefreshEvent(assetBalancesRefreshEvent) {
    console.log('emitAssetBalancesDataRefreshEvent');
    this.assetBalancesDataRefreshEvent$.next(assetBalancesRefreshEvent);
  }

  emitDebtsPerAssetDataRefreshEvent(debtsPerAsset) {
    console.log('emitDebtsPerAssetDataRefreshEvent');
    this.debtsPerAssetDataRefreshEvent$.next(debtsPerAsset);
  }

  emitHardRefreshScheduledEvent() {
    this.hardRefreshScheduledEvent$.next(null);
  }
}
