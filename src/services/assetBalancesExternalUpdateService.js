import {Subject} from 'rxjs';

export default class AssetBalancesExternalUpdateService {

  assetBalanceExternalUpdate$ = new Subject();

  emitExternalAssetBalanceUpdate(assetSymbol, balance, isLP, isTrueData = false) {
    console.log('emitting balance update: ', assetSymbol, balance, 'isLP', isLP, 'trueData: ', isTrueData);
    this.assetBalanceExternalUpdate$.next({assetSymbol: assetSymbol, balance: balance, isLP: isLP, isTrueData: isTrueData});
  }

  observeExternalAssetBalanceUpdate() {
    return this.assetBalanceExternalUpdate$.asObservable();
  }
};