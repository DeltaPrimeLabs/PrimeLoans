import {BehaviorSubject, combineLatest, map, Subject} from 'rxjs';
import config from '../config';
import POOL from '@artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {formatUnits, fromWei, parseUnits} from '@/utils/calculate';
import redstone from 'redstone-api';


const ethers = require('ethers');

export default class PoolService {

  ltipService;

  pools$ = new BehaviorSubject([]);
  pools = [];

  constructor(ltipService) {
    this.ltipService = ltipService;
  }


  emitPools(pools) {
    this.pools = pools;
    this.pools$.next(pools);
  }

  observePools() {
    return this.pools$.asObservable();
  }

  setupPools(provider, account, prices, sprimePerPool) {
    console.log('PoolService.setupPools');
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
          this.ltipService.observeLtipPoolData(),
        ]).pipe(map(poolDetails => {
          const deposit = formatUnits(String(poolDetails[1]), config.ASSETS_CONFIG[poolAsset].decimals);
          const apy = fromWei(poolDetails[2]);
          const totalBorrowed = formatUnits(String(poolDetails[4]), config.ASSETS_CONFIG[poolAsset].decimals);
          const tvl = formatUnits(String(poolDetails[0]), config.ASSETS_CONFIG[poolAsset].decimals);
          const isPoolDisabled = config.POOLS_CONFIG[poolAsset].disabled;
          const miningApy = 0

          const maxUtilisation = fromWei(poolDetails[5]);
          const pool = {
            asset: config.ASSETS_CONFIG[poolAsset],
            assetPrice: prices[poolAsset],
            contract: poolContract,
            tvl: isPoolDisabled ? 0 : tvl,
            deposit: deposit,
            apy: isPoolDisabled ? 0 : apy,
            borrowingAPY: isPoolDisabled ? 0 : fromWei(poolDetails[3]),
            totalBorrowed: isPoolDisabled ? 0 : totalBorrowed,
            interest: isPoolDisabled ? 0 : deposit * apy / 365,
            maxUtilisation: isPoolDisabled ? '0' : maxUtilisation,
            availableToWithdraw: tvl - totalBorrowed,
            availableToBorrow: (tvl * maxUtilisation) - totalBorrowed,
            utilisation: isPoolDisabled ? 0 : totalBorrowed / tvl,
            disabled: config.POOLS_CONFIG[poolAsset].disabled,
            poolsUnlocking: config.poolsUnlocking,
            miningApy: miningApy ? miningApy : null,
            sPrime: sprimePerPool[poolAsset] ? sprimePerPool[poolAsset].sPrime : 0,
          };
          return pool;
        }))
      })
    )
  }

  emitPoolDepositChange(amount, poolAssetSymbol, operation) {
    const pool = this.pools.find(pool => pool.asset.symbol === poolAssetSymbol);
    if (operation === 'DEPOSIT') {
      pool.deposit = Number(pool.deposit) + Number(amount);
    } else if (operation === 'WITHDRAW') {
      pool.deposit = Math.max(pool.deposit - amount, 0);
    }
    this.emitPools(this.pools);
  }
};