import {combineLatest, map, Subject} from 'rxjs';
import config from '../config';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import redstone from 'redstone-api';


const ethers = require('ethers');

export default class PoolService {
  refreshPools$ = new Subject();

  emitPools(pools) {
    console.log('emitting pools', pools);
    this.refreshPools$.next(pools);
  }

  observePools() {
    return this.refreshPools$.asObservable();
  }

  setupPools(provider, account) {
    const poolsFromConfig = Object.keys(config.POOLS_CONFIG);

    return combineLatest(
      poolsFromConfig.map(poolAsset => {
        const poolContract = new ethers.Contract(config.POOLS_CONFIG[poolAsset].address, POOL.abi, provider.getSigner());
        return combineLatest([
          poolContract.totalSupply(),
          poolContract.balanceOf(account),
          poolContract.getDepositRate(),
          poolContract.getBorrowingRate(),
          poolContract.totalBorrowed(),
          poolContract.getMaxPoolUtilisationForBorrowing(),
          redstone.getPrice(poolAsset)
        ]).pipe(map(poolDetails => {
          const deposit = formatUnits(String(poolDetails[1]), config.ASSETS_CONFIG[poolAsset].decimals);
          const apy = fromWei(poolDetails[2]);
          const pool = {
            asset: config.ASSETS_CONFIG[poolAsset],
            assetPrice: poolDetails[6].value,
            contract: poolContract,
            tvl: formatUnits(String(poolDetails[0]), config.ASSETS_CONFIG[poolAsset].decimals),
            deposit: deposit,
            apy: apy,
            borrowingAPY: fromWei(poolDetails[3]),
            totalBorrowed: formatUnits(String(poolDetails[4]), config.ASSETS_CONFIG[poolAsset].decimals),
            interest: deposit * apy / 365,
            maxUtilisation: fromWei(poolDetails[5])
          };
          return pool;
        }))
      })
    )
  }

  fetchPoolData(poolAsset, callback) {

  }
};