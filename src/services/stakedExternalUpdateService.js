import {Subject} from 'rxjs';

export default class StakedExternalUpdateService {

  totalStakedExternalUpdate$ = new Subject();
  stakedPerFarmExternalUpdate$ = new Subject();

  emitExternalTotalStakedUpdate(assetSymbol, stakedChange, action, isTrueData = false) {
    console.log('emitting total staked update: ', assetSymbol, stakedChange, isTrueData);
    this.totalStakedExternalUpdate$.next({
      assetSymbol: assetSymbol,
      stakedChange: stakedChange,
      action: action,
      isTrueData: isTrueData
    });
  }

  emitExternalStakedBalancesPerFarmUpdate(assetSymbol, protocol, stakedBalance, receiptTokenBalance) {
    console.log('emitting total staked per farm update: ', assetSymbol, protocol, stakedBalance, receiptTokenBalance);
    this.stakedPerFarmExternalUpdate$.next({
      assetSymbol: assetSymbol,
      protocol: protocol,
      stakedBalance: stakedBalance,
      receiptTokenBalance: receiptTokenBalance,
    });
  }

  observeExternalTotalStakedUpdate() {
    return this.totalStakedExternalUpdate$.asObservable();
  }

  observeExternalStakedBalancesPerFarmUpdate() {
    return this.stakedPerFarmExternalUpdate$.asObservable();
  }
};