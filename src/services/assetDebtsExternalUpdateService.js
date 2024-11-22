import {Subject} from 'rxjs';

export default class AssetDebtsExternalUpdateService {

  assetDebtExternalUpdate$ = new Subject();

  emitExternalAssetDebtUpdate(assetSymbol, debt, isTrueData = false) {
    console.log('emitting debt update: ', assetSymbol, debt, 'trueData: ', isTrueData);
    this.assetDebtExternalUpdate$.next({assetSymbol: assetSymbol, debt: debt, isTrueData: isTrueData});
  }

  observeExternalAssetDebtUpdate() {
    return this.assetDebtExternalUpdate$.asObservable();
  }
};