import {Subject} from 'rxjs';
import {calculateHealth} from '../utils/calculate';

export default class HealthService {
  refreshHealth$ = new Subject();

  emitRefreshHealth() {
    this.refreshHealth$.next(null);
  }

  observeRefreshHealth() {
    return this.refreshHealth$.asObservable();
  }

  async calculateHealth(noSmartLoan, debtsPerAsset, assets, assetBalances, lpAssets, lpBalances, stakeStoreFarms) {
    if (noSmartLoan) return 1;

    const redstonePriceDataRequest = await fetch('https://oracle-gateway-1.a.redstone.finance/data-packages/latest/redstone-avalanche-prod');
    const redstonePriceData = await redstonePriceDataRequest.json();

    if (debtsPerAsset && assets && assetBalances && lpAssets && lpBalances && stakeStoreFarms) {
      let tokens = [];
      for (const [symbol, data] of Object.entries(assets)) {
        let borrowed = debtsPerAsset[symbol] ? parseFloat(debtsPerAsset[symbol].debt) : 0;

        tokens.push({
          price: redstonePriceData[symbol][0].dataPoints[0].value,
          balance: parseFloat(assetBalances[symbol]),
          borrowed: borrowed,
          debtCoverage: data.debtCoverage,
          symbol: symbol
        });
      }

      for (const [symbol, data] of Object.entries(lpAssets)) {
        tokens.push({
          price: redstonePriceData[symbol][0].dataPoints[0].value,
          balance: parseFloat(lpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage,
          symbol: symbol

        });
      }

      for (const [symbol, farms] of Object.entries(stakeStoreFarms)) {
        farms.forEach(farm => {

          let feedSymbol = farm.feedSymbol ? farm.feedSymbol : symbol;

          tokens.push({
            price: redstonePriceData[feedSymbol][0].dataPoints[0].value,
            balance: parseFloat(farm.totalBalance),
            borrowed: 0,
            debtCoverage: farm.debtCoverage,
            symbol: symbol
          });
        });
      }

      console.log(tokens);

      const health = calculateHealth(tokens);
      return health >= 0 ? health : 0;
    }

    return 1;
  }
};