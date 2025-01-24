import {Subject} from 'rxjs';
import {calculateHealth} from '../utils/calculate';
import config from '../config';

export default class HealthService {
  refreshHealth$ = new Subject();
  health$ = new Subject();

  emitRefreshHealth() {
    this.refreshHealth$.next(null);
  }

  observeRefreshHealth() {
    return this.refreshHealth$.asObservable();
  }

  observeHealth() {
    return this.health$.asObservable();
  }

  async calculateHealth(
    noSmartLoan,
    debtsPerAsset,
    assets, assetBalances,
    lpAssets, lpBalances,
    concentratedLpAssets, concentratedLpBalances,
    balancerLpAssets, balancerLpBalances,
    levelAssets, levelBalances,
    gmxV2Assets, gmxV2Balances,
    penpieLpAssets, penpieLpBalances,
    wombatLpAssets, wombatLpBalances, wombatYYFarmsBalances,
    traderJoeV2LpAssets,
    stakeStoreFarms
  ) {
    console.log('askjdnasjkladn', penpieLpAssets);
    if (noSmartLoan) {
      return 1;
    }
    const someFarmsNotLoaded = Object.values(stakeStoreFarms).some((token) => {
      return token.some(bin => {
        return !bin.totalBalance || typeof bin.totalBalance === 'number'
      })
    })
    if (someFarmsNotLoaded) {
      return;
    }

    const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
    const redstonePriceData = await redstonePriceDataRequest.json();

    if (debtsPerAsset && assets && assetBalances && lpAssets && lpBalances && stakeStoreFarms) {
      let tokens = [];
      for (const [symbol, data] of Object.entries(assets)) {
        let borrowed = debtsPerAsset[symbol] ? parseFloat(debtsPerAsset[symbol].debt) : 0;

        tokens.push({
          price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
          balance: parseFloat(assetBalances[symbol]),
          borrowed: borrowed,
          debtCoverage: data.debtCoverage,
          symbol: symbol
        });
      }

      for (const [symbol, data] of Object.entries(lpAssets)) {
        tokens.push({
          price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
          balance: parseFloat(lpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage,
          symbol: symbol

        });
      }

      for (const [symbol, data] of Object.entries(concentratedLpAssets)) {
        tokens.push({
          price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
          balance: parseFloat(concentratedLpBalances[symbol]),
          borrowed: 0,
          debtCoverage: data.debtCoverage,
          symbol: symbol
        });
      }

      if (levelAssets) {
        for (const [symbol, data] of Object.entries(levelAssets)) {
          tokens.push({
            price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
            balance: parseFloat(levelBalances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }
      }

      if (balancerLpAssets) {
        for (const [symbol, data] of Object.entries(balancerLpAssets)) {
          tokens.push({
            price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
            balance: parseFloat(balancerLpBalances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }
      }

      if (gmxV2Assets) {
        for (const [symbol, data] of Object.entries(gmxV2Assets)) {
          tokens.push({
            price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
            balance: parseFloat(gmxV2Balances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }
      }

      if (penpieLpAssets) {
        for (const [symbol, data] of Object.entries(penpieLpAssets)) {
          tokens.push({
            price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
            balance: parseFloat(penpieLpBalances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }
      }

      if (wombatLpAssets) {
        for (const [symbol, data] of Object.entries(wombatLpAssets)) {
          tokens.push({
            price: redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0,
            balance: parseFloat(wombatLpBalances[symbol]),
            borrowed: 0,
            debtCoverage: data.debtCoverage,
            symbol: symbol
          });
        }
      }

      if (wombatYYFarmsBalances) {
        for (const farm of config.WOMBAT_YY_FARMS) {
          tokens.push({
            price: wombatLpAssets[farm.lpAssetToken].price ? wombatLpAssets[farm.lpAssetToken].price : 0,
            balance: parseFloat(wombatYYFarmsBalances[farm.apyKey]),
            borrowed: 0,
            debtCoverage: farm.debtCoverage,
            symbol: farm.apyKey
          });
        }
      }

      for (const [symbol, farms] of Object.entries(stakeStoreFarms)) {
        farms.forEach(farm => {
          let feedSymbol = farm.feedSymbol ? farm.feedSymbol : symbol;
          console.log('farm', farm);
          console.log('symbol', symbol);
          console.log('feedSymbol', feedSymbol);
          console.log('redstonePriceData[feedSymbol]', redstonePriceData[feedSymbol]);
          tokens.push({
            price: redstonePriceData[feedSymbol] ? redstonePriceData[feedSymbol][0].dataPoints[0].value : 0,
            balance: parseFloat(farm.totalBalance),
            borrowed: 0,
            debtCoverage: farm.debtCoverage,
            symbol: symbol
          });
        });
      }

      let lbTokens = Object.values(traderJoeV2LpAssets);

      console.log(tokens);
      console.log(lbTokens);

      const health = calculateHealth(tokens, lbTokens);
      this.health$.next(health >= 0 ? health : 0);

      return health >= 0 ? health : 0;
    }

    this.health$.next(1);
    return 1;
  }
};
