import {BehaviorSubject, Subject} from 'rxjs';
import config from '../config';
import {wrapContract} from '../utils/blockchain';
import {fillBinsArray, formatUnits, fromWei, getBinPrice, uniswapV3TickToPrice} from '../utils/calculate';
import SPRIME from '@artifacts/contracts/interfaces/ISPrime.sol/ISPrime.json';
import UNI_V3_POSITION_MANAGER
  from '@artifacts/contracts/interfaces/uniswap-v3-periphery/INonfungiblePositionManager.sol/INonfungiblePositionManager.json';
import TRADERJOE_V2_POSITION_MANAGER from '@artifacts/contracts/interfaces/IPositionManager.sol/IPositionManager.json';

import ARBITRUM_REVENUE_DISTRIBUTION_EPOCH_0
  from '../data/arbitrum/revenue-distribution/distributionHistoryArbitrumEpoch0.json';
import AVALANCHE_REVENUE_DISTRIBUTION_EPOCH_0
  from '../data/avalanche/revenue-distribution/distributionHistoryAvalancheEpoch0.json';


const ethers = require('ethers');

export default class sPrimeService {
  sPrimeValue$ = new BehaviorSubject(null);
  sPrimeBalance$ = new BehaviorSubject(null);
  sPrimeLockedBalance$ = new BehaviorSubject(null);
  sPrimeTotalValue$ = new BehaviorSubject(null);
  sPrimePositionInfo$ = new BehaviorSubject(null);
  poolPrice$ = new BehaviorSubject(null);
  revenueReceived$ = new BehaviorSubject(null);
  totalRevenueReceived$ = new BehaviorSubject(null);

  emitRefreshSPrimeDataWithDefault(provider, ownerAddress) {
    //needs to be updated when more than one sPRIME per chain
    let defaultDex = config.SPRIME_CONFIG.default;
    let defaultSecondAsset = config.SPRIME_CONFIG[config.SPRIME_CONFIG.default].default;
    let defaultConfig = config.SPRIME_CONFIG[defaultDex][defaultSecondAsset];
    this.emitRefreshSPrimeData(provider, defaultConfig.sPrimeAddress, defaultConfig.poolAddress, defaultDex, defaultSecondAsset, ownerAddress, defaultConfig.revenueAwsEndpoint);
  }

  emitRefreshSPrimeData(provider, sPrimeAddress, poolAddress, dex, secondAsset, ownerAddress, revenueAwsEndpoint) {
    this.updateSPrimeData(provider, sPrimeAddress, poolAddress, dex, secondAsset, ownerAddress, revenueAwsEndpoint);
  }

  observeSPrimeValue() {
    return this.sPrimeValue$.asObservable();
  }

  observeSPrimeBalance() {
    return this.sPrimeBalance$.asObservable();
  }

  observeSPrimeLockedBalance() {
    return this.sPrimeLockedBalance$.asObservable();
  }

  observeSPrimeTotalValue() {
    return this.sPrimeTotalValue$.asObservable();
  }

  observeSPrimeUnderlyingPool() {
    return this.poolPrice$.asObservable();
  }

  observeSPrimePositionInfo() {
    return this.sPrimePositionInfo$.asObservable();
  }

  observeRevenueReceived() {
    return this.revenueReceived$.asObservable();
  }

  observeTotalRevenueReceived() {
    return this.totalRevenueReceived$.asObservable();
  }

  async updateSPrimeData(provider, sPrimeAddress, poolAddress, dex, secondAsset, ownerAddress, revenueAwsEndpoint) {
    const walletAddress = provider.provider.selectedAddress;
    let dataFeeds = [...Object.keys(config.POOLS_CONFIG), secondAsset, 'PRIME'];

    const sPrimeContract = await wrapContract(new ethers.Contract(sPrimeAddress, SPRIME.abi, provider.getSigner()), dataFeeds);

    fetch(config.redstoneFeedUrl).then(
      res => {
        res.json().then(
          redstonePriceData => {
            let secondAssetPrice = redstonePriceData[secondAsset][0].dataPoints[0].value;

            sPrimeContract.totalSupply().then(
              async value => {
                value = formatUnits(value) * secondAssetPrice;

                this.sPrimeTotalValue$.next(value)
              }
            );

              sPrimeContract.balanceOf(ownerAddress).then(
              async value => {
                this.sPrimeBalance$.next(formatUnits(value))
              }
            );

              sPrimeContract.getLockedBalance(ownerAddress).then(
              async value => {
                this.sPrimeLockedBalance$.next(formatUnits(value))

              }
            );

            if (dex === 'UNISWAP') {
                sPrimeContract.getUserValueInTokenY(ownerAddress).then(
                async value => {
                  value = formatUnits(value, config.ASSETS_CONFIG[secondAsset].decimals) * secondAssetPrice;

                  this.sPrimeValue$.next(value)

                }
              );

              sPrimeContract.getPoolPrice().then(

                poolPrice => {
                  this.poolPrice$.next(poolPrice * secondAssetPrice / 1e8)
                }
              );

              sPrimeContract.userTokenId(ownerAddress).then(
                tokenId => {
                  let positionManager = new ethers.Contract(config.SPRIME_CONFIG[dex][secondAsset].positionManagerAddress, UNI_V3_POSITION_MANAGER.abi, provider.getSigner());

                  positionManager.positions(tokenId).then(
                    res => {
                      this.sPrimePositionInfo$.next(
                        {
                          priceMin: uniswapV3TickToPrice(res.tickLower) * secondAssetPrice,
                          priceMax: uniswapV3TickToPrice(res.tickUpper) * secondAssetPrice
                        });
                    }
                  )
                }
              )
            }

            if (dex === 'TRADERJOEV2') {
                sPrimeContract.getUserValueInTokenY(ownerAddress).then(
                    async value => {
                        value = formatUnits(value, config.ASSETS_CONFIG[secondAsset].decimals) * secondAssetPrice;

                        this.sPrimeValue$.next(value)
                    }
                );

              sPrimeContract.getPoolPrice().then(
                poolPrice => {
                  this.poolPrice$.next(poolPrice * secondAssetPrice / 1e8)
                }
              );

              sPrimeContract.getUserTokenId(ownerAddress).then(
                tokenId => {
                  let positionManager = new ethers.Contract(config.SPRIME_CONFIG[dex][secondAsset].positionManagerAddress, TRADERJOE_V2_POSITION_MANAGER.abi, provider.getSigner());

                  positionManager.positions(tokenId).then(
                    res => {
                      let centerId = res.centerId;
                      let numberOfBins = res.liquidityMinted.length;
                      if (numberOfBins > 0) {
                        let binsArray = fillBinsArray(centerId, numberOfBins);
                        binsArray = binsArray.map(
                          binId => secondAssetPrice * getBinPrice(binId, config.SPRIME_CONFIG[dex][secondAsset].binStep, 18, config.SPRIME_CONFIG[dex][secondAsset].secondAssetDecimals)
                        )

                        this.sPrimePositionInfo$.next(
                          {
                            binsArray: binsArray
                          });
                      }
                    }
                  )
                }
              )
            }

            let revenueReceived;
            const revenueReceivedJson = config.chainSlug === 'arbitrum' ? ARBITRUM_REVENUE_DISTRIBUTION_EPOCH_0 : AVALANCHE_REVENUE_DISTRIBUTION_EPOCH_0;
            revenueReceived = revenueReceivedJson[walletAddress] ? revenueReceivedJson[walletAddress].amount * secondAssetPrice : 0;
            this.revenueReceived$.next(revenueReceived);
          }
        )
      }
    );

    fetch(revenueAwsEndpoint).then(
        res => {
            res.json().then(
                ([totalRevenue, numOfAccounts]) => {
                    this.totalRevenueReceived$.next(totalRevenue);
                }
            )
        }
    );

  }
};