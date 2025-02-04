<template>
  <div class="sprime-panel-component" v-bind:class="{'sprime-panel-component--expanded': expanded}">
    <div class="header-actions">
      <a v-if="sPrimeConfig" :href="sPrimeConfig.dexWebsite" target="_blank">
        <FlatButton :active="!this.isActionDisabledRecord['BUY']">get prime <img class="buy-prime-logo"
                                                                                 src="src/assets/logo/prime.svg"/>
        </FlatButton>
      </a>
      <div v-on:click="toggleExpand()">
        <DeltaIcon class="chevron" v-bind:class="{'chevron--expanded': expanded}"
                   :icon-src="'src/assets/icons/chevron-down.svg'" :size="21"></DeltaIcon>
      </div>
    </div>
    <div class="sprime-panel__actions sprime-panel__actions--collapsed">
      <div class="sprime">
        <img class="sprime-logo"
             v-if="secondAsset"
             :src="`src/assets/logo/sprime-${secondAsset.toLowerCase()}.svg`"/>
        <div class="sprime__text">
          sPRIME
        </div>
      </div>
      <div class="actions-info">
        <div class="actions-info__entry">
          <div class="actions-info__label">Total value:</div>
          <div class="actions-info__value">{{ value | usd }}</div>
        </div>
        <div class="actions-info__divider"></div>
        <div class="actions-info__entry">
          <div class="actions-info__label">Distribution:</div>
          <img v-if="distributionType" :src="getDistributionIcon" class="actions-info__distribution-icon">
        </div>
        <div class="actions-info__divider"></div>
        <div class="actions-info__entry">
          <div class="actions-info__label">Governance power:</div>
          <div class="actions-info__value" :class="{'negative': governancePoints && governancePoints < 0}">
            {{ formatTokenBalanceWithLessThan(governancePoints, 4, true) }}
          </div>
        </div>
        <div class="actions-info__divider"></div>
        <div class="actions-info__entry">
          <FlatButton v-on:buttonClick="openMintSPrimeModal()" :active="!this.isActionDisabledRecord['MINT']">mint
          </FlatButton>
        </div>
      </div>
    </div>
    <div class="sprime-panel__actions sprime-panel__actions--expanded">
      <div class="sprime">
        <img class="sprime-logo"
             v-if="secondAsset"
             :src="`src/assets/logo/sprime-${secondAsset.toLowerCase()}.svg`"/>
        <div>
          sPRIME
        </div>
      </div>
      <div class="actions">
        <FlatButton v-on:buttonClick="openMintSPrimeModal()" :active="!this.isActionDisabledRecord['MINT']">mint
        </FlatButton>
        <FlatButton v-on:buttonClick="openRebalanceSPrimeModal()"
                    :active="!this.isActionDisabledRecord['REBALANCE'] && value > 0">rebalance
        </FlatButton>
        <FlatButton v-on:buttonClick="openRedeemSPrimeModal()"
                    :active="!this.isActionDisabledRecord['REDEEM'] && value > 0">redeem
        </FlatButton>
      </div>
      <div class="sprime-panel__divider"></div>
    </div>
    <div class="sprime-panel__body">
      <div class="stats">
        <div class="stat">
          <div class="stat__title">Total value
            <InfoIcon class="stat__info-icon" :size="16"
                      :tooltip="{ content: 'Total $ value of your sPRIME.'}"></InfoIcon>
          </div>
          <div class="stat__value">{{ value | usd }}</div>
          <div class="stat__extra-info">Locked: {{ lockedInUd | usd }}</div>
        </div>
        <div class="stat">
          <div class="stat__title">Revenue received
            <InfoIcon class="stat__info-icon" :size="16"
                      :tooltip="{ content: 'DeltaPrime fees distributed to your sPRIME. You are eligible for fees only when your sPRIME is active.'}"></InfoIcon>
          </div>
          <div class="stat__value">
            <div class="stat__value">{{ revenueReceived | usd }}</div>
          </div>
        </div>
        <div class="stat">
          <div class="stat__title">YTD APR
            <InfoIcon class="stat__info-icon" :size="16"
                      :tooltip="{ content: 'Based on YTD performance of DeltaPrime fees.'}"></InfoIcon>
          </div>
          <div class="stat__value"> {{ ytdApr | percent }}</div>
        </div>
      </div>
      <div class="distribution">
        <div class="distribution__title">Distribution</div>
        <div class="chart-container">
          <div class="distribution-chart-line"></div>
          <DistributionChart v-if="dex === 'TRADERJOEV2' && chartData" :data="chartData" :active-price="poolPrice"
                             :active-index="activeBinIndex"></DistributionChart>
          <PriceRangeChart v-if="dex === 'UNISWAP' && chartData"
                           :active-value="chartData.activeValue"
                           :axis-start="chartData.axisStart"
                           :axis-end="chartData.axisEnd"
                           :range-start="chartData.rangeStart"
                           :range-end="chartData.rangeEnd"
          ></PriceRangeChart>
        </div>
      </div>
      <div class="governance">
        <div class="governance__title">Governance power</div>
        <div class="power-gauge">
          <div class="gauge__value">
            {{ formatTokenBalanceWithLessThan(governancePoints, 3, true) }}
          </div>
        </div>
      </div>
      <div class="rates">
        <div class="rate">
          <div class="rate__title">Accrual rate (daily)</div>
          <div class="rate__value governance-rate" :class="{'negative': governanceRate && governanceRate < 0}">
            {{ governanceRate ? governanceRate.toFixed(2) : 0 }}
          </div>
          <div class="rate__extra-info">Max governance power: {{ balanceLimit }}</div>
        </div>
        <div class="rate">
          <div class="rate__title">Next accrual rate</div>
          <div class="rate__value">{{ maxGovernanceRate ? maxGovernanceRate.toFixed(2) : 0 }}</div>
          <div class="rate__extra-info">({{ maxGovernanceRateMessage }})</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import FlatButton from './FlatButton.vue';
import {mapActions, mapState} from 'vuex';
import config from '../config';
import {combineLatest} from 'rxjs';
import MintsPrimeModal from './MintsPrimeModal.vue';
import erc20ABI from '../abis/ERC20.json';
import {getTraderJoeV2IdSlippageFromPriceSlippage, getUniswapV3SlippageFromPriceSlippage} from '../utils/calculate';
import RedeemsPrimeModal from './RedeemsPrimeModal.vue';
import RebalancesPrimeModal from './RebalancesPrimeModal.vue';
import DistributionChart from './DistributionChart.vue';
import DeltaIcon from './DeltaIcon.vue';
import InfoIcon from './InfoIcon.vue';
import PriceRangeChart from './PriceRangeChart.vue';
import {ActionSection} from '../services/globalActionsDisableService';

const ethers = require('ethers');

let TOKEN_ADDRESSES;

const V_PRIME_PAIR_RATIO = 10;
const BORROWER_YEARLY_V_PRIME_RATE = 1;
const DEPOSITOR_YEARLY_V_PRIME_RATE = 5;

const DistributionType = {
  RIGHT_NEUTRAL: 'RIGHT_NEUTRAL',
  LEFT_NEUTRAL: 'LEFT_NEUTRAL',
  LEFT_POSITIVE: 'LEFT_POSITIVE',
  LEFT_NEGATIVE: 'LEFT_NEGATIVE',
  RIGHT_NEGATIVE: 'RIGHT_NEGATIVE',
}

const DISTRIBUTION_ICON_DICTIONARY = {
  [DistributionType.RIGHT_NEUTRAL]: 'right-neutral',
  [DistributionType.LEFT_NEUTRAL]: 'left-neutral',
  [DistributionType.LEFT_POSITIVE]: 'left-positive',
  [DistributionType.LEFT_NEGATIVE]: 'left-negative',
  [DistributionType.RIGHT_NEGATIVE]: 'right-negative',
}

export default {
  name: 'SPrimePanel',
  components: {PriceRangeChart, InfoIcon, DeltaIcon, DistributionChart, FlatButton},
  props: {
    isPrimeAccount: false,
    totalDepositsOrBorrows: null
  },
  data() {
    return {
      dex: null,
      secondAsset: null,
      sPrimeConfig: null,
      sPrimeActive: true,
      value: null,
      locked: null,
      lockedInUd: null,
      ytdApr: null,
      governancePoints: null,
      governanceRate: null,
      maxGovernanceRateMessage: null,
      expanded: false,
      isActionDisabledRecord: {},
      distributionType: null,
      chartData: null,
      activeBinIndex: null,
      poolPrice: null,
      balanceLimit: null,
      revenueReceived: null
    };
  },
  mounted() {
    this.setupFiles();
    this.dex = config.SPRIME_CONFIG.default;
    this.secondAsset = config.SPRIME_CONFIG[this.dex].default;
    this.sPrimeConfig = config.SPRIME_CONFIG[this.dex][this.secondAsset];
    console.log(this.secondAsset);

    const sprimeStart = new Date();
    sprimeStart.setDate(1);
    sprimeStart.setMonth(6);
    sprimeStart.setFullYear(2024);
    const today = new Date();
    const diffTime = today - sprimeStart;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    combineLatest([
      this.accountService.observeAccountLoaded(),
      this.providerService.observeProviderCreated()
    ]).subscribe(([account, provider]) => {
      this.fetchSPrimeData();
    });

    combineLatest([
      this.sPrimeService.observeSPrimeValue(),
      this.sPrimeService.observeSPrimeBalance(),
      this.sPrimeService.observeSPrimeLockedBalance(),
      this.sPrimeService.observeRevenueReceived(),
    ]).subscribe(([value, balance, locked, revenueReceived]) => {
      this.value = value;
      this.locked = locked;
      this.lockedInUd = value * locked / balance;
      this.revenueReceived = revenueReceived;
    });

    this.sPrimeService.observeSPrimeValue().subscribe(value => {
      this.value = value
    });

    combineLatest([
      this.sPrimeService.observeSPrimeTotalValue(),
      this.sPrimeService.observeTotalRevenueReceived()
    ])
      .subscribe(([totalValue, totalRevenue]) => {
        this.ytdApr = totalRevenue / totalValue / diffDays * 365;
      });

    combineLatest([
      this.sPrimeService.observeSPrimeUnderlyingPool(),
      this.sPrimeService.observeSPrimePositionInfo()
    ])
      .subscribe(([poolPrice, positionInfo]) => {
        if (positionInfo) {
          this.poolPrice = poolPrice;
          if (this.dex === 'TRADERJOEV2') {
            let positive = true;
            this.chartData = positionInfo.binsArray.map(
              (binPrice, i) => {
                let showTick = (i === 0) || (i === (positionInfo.binsArray.length - 1));
                if (this.poolPrice <= binPrice && this.poolPrice > positionInfo.binsArray[i - 1]) {
                  const toPrevious = this.poolPrice - positionInfo.binsArray[i - 1];
                  const toCurrent = this.poolPrice - binPrice;

                  this.activeBinIndex = toPrevious >= toCurrent ? i : i - 1
                }
                return {x: binPrice, y: 3, showTick: showTick, positive: positive}
              }
            )
            const stepLength = positionInfo.binsArray[1] - positionInfo.binsArray[0]
            if (this.poolPrice < positionInfo.binsArray[0]) {
              const emptyStepsCount = Math.abs((this.poolPrice - positionInfo.binsArray[0]) / stepLength)
              const emptySteps = []
              for (let i = 0; i < Math.floor(emptyStepsCount); i++) {
                const lastStep = i === 0 ? positionInfo.binsArray[0] : emptySteps[0].x
                emptySteps.unshift({x: lastStep - stepLength, y: 0, showTick: false, positive: false})
              }
              this.chartData = [{
                x: this.poolPrice,
                y: 0,
                showTick: false,
                positive: false
              }, ...emptySteps, ...this.chartData]
              this.activeBinIndex = 0;
            } else if (this.poolPrice > positionInfo.binsArray[positionInfo.binsArray.length - 1]) {
              const emptyStepsCount = Math.abs((this.poolPrice - positionInfo.binsArray[positionInfo.binsArray.length - 1]) / stepLength)
              const emptySteps = []
              for (let i = 0; i < Math.floor(emptyStepsCount); i++) {
                const lastStep = i === 0 ? positionInfo.binsArray[positionInfo.binsArray.length - 1] : emptySteps[emptySteps.length - 1].x
                emptySteps.push({x: lastStep + stepLength, y: 0, showTick: false, positive: false})
              }
              this.chartData = [...this.chartData, ...emptySteps, {
                x: this.poolPrice,
                y: 0,
                showTick: false,
                positive: false
              }]
              this.activeBinIndex = this.chartData.length - 1
            }
            this.setDistributionChart(this.poolPrice, positionInfo.binsArray[0], positionInfo.binsArray[positionInfo.binsArray.length - 1]);
          }
          if (this.dex === 'UNISWAP') {
            let rangeStart = positionInfo.priceMin;
            let rangeEnd = positionInfo.priceMax;
            let minValue = Math.min(this.poolPrice, rangeStart);
            let maxValue = Math.max(this.poolPrice, rangeEnd);
            let axisStart = minValue - 0.05 * minValue;
            let axisEnd = maxValue + 0.05 * maxValue;

            this.chartData = {
              activeValue: this.poolPrice,
              rangeStart: rangeStart,
              rangeEnd: rangeEnd,
              axisStart: axisStart,
              axisEnd: axisEnd
            }

            this.setDistributionChart(poolPrice, rangeStart, rangeEnd);
          }
        }
      });

    this.accountService.observeAccountLoaded().subscribe(() => {
      this.fetchVPrimeData();
    });

    this.vPrimeService.observeVPrimePoints().subscribe(points => {
      this.governancePoints = points ? points.toExponential(1) : 0;
    });

    this.vPrimeService.observeVPrimeRate().subscribe(rate => {
      this.governanceRate = rate;
    });

    this.vPrimeService.observeVPrimeBalanceLimit().subscribe(balanceLimit => {
      this.balanceLimit = balanceLimit;
    });

    this.watchActionDisabling();
  },
  watch: {},
  computed: {
    ...mapState('serviceRegistry', [
      'sPrimeService',
      'vPrimeService',
      'providerService',
      'accountService',
      'traderJoeService',
      'uniswapV3Service',
      'themeService',
      'progressBarService',
      'globalActionsDisableService',
      'priceService'
    ]),
    ...mapState('network', ['provider', 'account']),
    ...mapState('fundsStore', ['assets']),
    getDistributionIcon() {
      return `src/assets/icons/sprime-distribution/${DISTRIBUTION_ICON_DICTIONARY[this.distributionType]}${this.themeService.themeChange$.value === 'LIGHT' ? '' : '--dark'}.svg`;
    },
    maxGovernanceRate() {
      let maxsPrimeFromCeil = Math.ceil(this.value);
      let maxsPrimeFromDeposit = Math.floor(this.totalDepositsOrBorrows / 10);
      let maxsPrime = Math.max(maxsPrimeFromCeil, maxsPrimeFromDeposit);
      let depositFromMaxsPrime = maxsPrime * 10;

      let missingDeposit = Math.max(depositFromMaxsPrime - this.totalDepositsOrBorrows, 0);
      let missingSPrime = maxsPrime - this.value;

      let maxRate = maxsPrime * (this.isPrimeAccount ? BORROWER_YEARLY_V_PRIME_RATE : DEPOSITOR_YEARLY_V_PRIME_RATE);

      if (this.isPrimeAccount && maxRate <= this.governanceRate) {
        this.maxGovernanceRateMessage = `Based on your Savings`
      } else if (missingDeposit) {
        let action = this.isPrimeAccount ? `Borrow` : `Deposit`;
        this.maxGovernanceRateMessage = `${action} $${missingDeposit.toFixed(2)} and mint $${missingSPrime.toFixed(2)} sPRIME`;
      } else {
        this.maxGovernanceRateMessage = `Mint $${missingSPrime.toFixed(2)} sPRIME`;
      }

      return Math.max(maxRate, this.governanceRate) / 365;
    }
  },
  methods: {
    ...mapActions('sPrimeStore', [
      'sPrimeMint',
      'sPrimeRebalance',
      'sPrimeRedeem'
    ]),
    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },
    async openMintSPrimeModal() {
      this.priceService.observePrices().subscribe(async (prices) => {

        const modalInstance = this.openModal(MintsPrimeModal);
        let activeId, currentPrice;
        if (this.dex === 'TRADERJOEV2') {
          [, activeId] = await this
            .traderJoeService
            .getLBPairReservesAndActiveBin(this.sPrimeConfig.poolAddress, this.provider)
        } else {
          [currentPrice, activeId] = await this
            .uniswapV3Service
            .getPriceAndActiveId(this.sPrimeConfig.poolAddress, this.provider)
        }

        const [primeBalance, secondAssetBalance] = await Promise.all(
          [
            this.fetchUserTokenBalance('PRIME'),
            this.fetchUserTokenBalance(this.secondAsset)
          ]
        );

        const nativeTokenBalance = parseFloat(ethers.utils.formatEther(await this.provider.getBalance(this.account)));
        modalInstance.primeBalance = primeBalance;
        modalInstance.firstAssetPrice = this.poolPrice;
        modalInstance.secondAssetPrice = prices[this.secondAsset];
        modalInstance.secondAssetBalance = secondAssetBalance;
        modalInstance.secondAssetSymbol = this.secondAsset;
        modalInstance.nativeTokenBalance = nativeTokenBalance;
        modalInstance.isSecondAssetNative = this.secondAsset === config.nativeToken;
        modalInstance.sPrimeActive = this.sPrimeActive;
        modalInstance.$on('MINT', sPrimeMintEvent => {

          const idSlippage = this.dex === 'TRADERJOEV2' ?
            getTraderJoeV2IdSlippageFromPriceSlippage(sPrimeMintEvent.slippage / 100, config.SPRIME_CONFIG.TRADERJOEV2[this.secondAsset].binStep)
            : getUniswapV3SlippageFromPriceSlippage(currentPrice, sPrimeMintEvent.slippage / 100);

          const sPrimeMintRequest = {
            sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
            secondAsset: this.secondAsset,
            isRebalance: true,
            amountPrime: sPrimeMintEvent.primeAmount,
            amountSecond: sPrimeMintEvent.secondAmount,
            isSecondAssetNative: sPrimeMintEvent.isSecondAssetNative,
            idSlippage: idSlippage,
            slippage: sPrimeMintEvent.slippage,
            dex: this.dex,
            activeId: activeId
          };

          this.handleTransaction(this.sPrimeMint, {sPrimeMintRequest: sPrimeMintRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        });
      })
    },
    async openRebalanceSPrimeModal() {
      const modalInstance = this.openModal(RebalancesPrimeModal);
      let activeId, currentPrice;
      if (this.dex === 'TRADERJOEV2') {
        [, activeId] = await this
          .traderJoeService
          .getLBPairReservesAndActiveBin(this.sPrimeConfig.poolAddress, this.provider)
      } else {
        [currentPrice, activeId] = await this
          .uniswapV3Service
          .getPriceAndActiveId(this.sPrimeConfig.poolAddress, this.provider)
      }
      modalInstance.secondAssetSymbol = this.secondAsset;

      modalInstance.$on('REBALANCE', event => {
        const idSlippage = this.dex === 'TRADERJOEV2' ?
          getTraderJoeV2IdSlippageFromPriceSlippage(event.slippage / 100, config.SPRIME_CONFIG.TRADERJOEV2[this.secondAsset].binStep)
          : getUniswapV3SlippageFromPriceSlippage(currentPrice, event.slippage / 100);

        let sPrimeRebalanceRequest = {
          sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
          secondAsset: this.secondAsset,
          isRebalance: true,
          idSlippage: idSlippage,
          slippage: event.slippage,
          dex: this.dex,
          activeId: activeId
        };
        this.handleTransaction(this.sPrimeRebalance, {sPrimeRebalanceRequest: sPrimeRebalanceRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },
    async openRedeemSPrimeModal() {
      const modalInstance = this.openModal(RedeemsPrimeModal);
      let [primeBalance, secondAssetBalance] = await Promise.all(
        [this.fetchUserTokenBalance('PRIME'),
          this.fetchUserTokenBalance(this.secondAsset)]
      );

      const sPrimeTokenContract = new ethers.Contract(this.sPrimeConfig.sPrimeAddress, erc20ABI, this.provider.getSigner());
      const sPrimeBalance = await this.getWalletTokenBalance(this.account, 'sPRIME', sPrimeTokenContract, 18);

      modalInstance.primeBalance = primeBalance;
      modalInstance.secondAssetBalance = secondAssetBalance;
      modalInstance.secondAssetSymbol = this.secondAsset;
      modalInstance.sPrimeBalance = sPrimeBalance;
      modalInstance.sPrimeValue = this.value;
      modalInstance.sPrimeLockedBalance = this.locked;
      modalInstance.sPrimeLockedValue = this.lockedInUd;

      modalInstance.$on('REDEEM', sPrimeRedeemEvent => {
        let sPrimeRedeemRequest = {
          sPrimeAddress: this.sPrimeConfig.sPrimeAddress,
          secondAsset: this.secondAsset,
          share: sPrimeRedeemEvent.sPrimeToRedeem.toFixed(18)
        };
        this.handleTransaction(this.sPrimeRedeem, {sPrimeRedeemRequest: sPrimeRedeemRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },
    fetchSPrimeData() {
      this.sPrimeService.emitRefreshSPrimeData(this.provider, this.sPrimeConfig.sPrimeAddress, this.sPrimeConfig.poolAddress, this.dex, this.secondAsset, this.account, this.sPrimeConfig.revenueAwsEndpoint);
    },
    fetchVPrimeData() {
      this.vPrimeService.emitRefreshVPrimeData(config.VPRIME_CONFIG.address, this.account);
    },
    async fetchUserTokenBalance(tokenSymbol) {
      const contract = new ethers.Contract(TOKEN_ADDRESSES[tokenSymbol], erc20ABI, this.provider.getSigner());

      return this.getWalletTokenBalance(
        this.account,
        tokenSymbol,
        contract,
        tokenSymbol === 'PRIME' ? config.PRIME.decimals : config.ASSETS_CONFIG[tokenSymbol].decimals
      );
    },

    handleTransactionError(error) {
      if (String(error) === '[object Object]' || typeof error === 'object') {
        switch (error.code) {
          case 4001:
            this.progressBarService.emitProgressBarCancelledState()
            this.closeModal();
            break;
          case 404:
            this.progressBarService.emitProgressBarErrorState('Action is currently disabled')
            break;
        }
      }
    },

    toggleExpand() {
      this.expanded = !this.expanded;
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.SPRIME)
        .subscribe(isActionDisabledRecord => {
          this.isActionDisabledRecord = isActionDisabledRecord;
        })
    },

    setDistributionChart(poolPrice, minPrice, maxPrice) {
      if (minPrice <= this.poolPrice && maxPrice >= this.poolPrice) {
        this.distributionType = DistributionType.LEFT_POSITIVE;
        this.sPrimeActive = true;
      }
      if (minPrice > this.poolPrice) this.distributionType = DistributionType.LEFT_NEGATIVE;
      if (maxPrice < this.poolPrice) this.distributionType = DistributionType.RIGHT_NEGATIVE;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.sprime-panel-component {
  position: relative;
  height: 60px;
  transition: height 200ms ease-in-out;
  display: flex;
  flex-direction: column;
  border-radius: 35px;
  background-color: var(--s-prime-panel__panel-background-color);
  box-shadow: var(--s-prime-panel__panel-box-shadow);
  margin-top: 30px;
  overflow: hidden;

  .header-actions {
    position: absolute;
    top: 17px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    z-index: 1;

    .chevron {
      cursor: pointer;
      background: var(--s-prime-panel__chevron-color);
      transition: transform 200ms ease-in-out;

      &:hover {
        background: var(--s-prime-panel__chevron-color--hover);
      }

      &.chevron--expanded {
        transform: rotate(180deg);
      }
    }

    .buy-prime-logo {
      width: 20px;
      height: 20px;
      margin-left: 6px;
    }
  }

  &.sprime-panel-component--expanded {
    height: 330px;

    .sprime-panel__actions--expanded {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .sprime-panel__actions--collapsed {
      opacity: 0;
      transform: translateY(100%) !important;
      pointer-events: none;
    }
  }

  .sprime-panel__actions {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 16px 0;
    transition: opacity 200ms ease-in-out, transform 200ms ease-in-out;
    transform: translateY(-100%);

    &--expanded {
      opacity: 0;
      pointer-events: none;

      .sprime-logo {
        width: 26px;
      }
    }

    &--collapsed {
      position: absolute;
      width: 100%;
      transform: translateY(0);
      padding: 17px 0;

      .sprime {
        position: absolute;
        left: 24px;
        top: 19px;
      }

      .sprime-logo {
        width: 26px;
        height: 26px;
        margin-right: 5px;
      }

      .sprime__text {
        color: var(--s-prime-panel__secondary-text-color);
        font-size: 16px;
        font-weight: 600;
      }

      .actions-info {
        display: flex;
        justify-content: center;
        align-items: center;

        .actions-info__entry:not(:last-child) {
          margin-right: 19px;
        }

        .actions-info__divider {
          background: var(--s-prime-panel__actions-info-divider-background);
          margin-right: 19px;
          height: 20px;
          width: 2px;
          border-radius: 2px;
        }

        .actions-info__entry {
          display: flex;
          font-size: 16px;
          font-weight: 500;
        }

        .actions-info__label {
          margin-right: 8px;
          color: var(--s-prime-panel__main-text-color);
        }

        .actions-info__value {
          color: var(--s-prime-panel__secondary-text-color);
        }

        .actions-info__distribution-icon {
          margin-top: -5px;
        }
      }
    }

    .sprime {
      margin-right: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--s-prime-panel__sprime-color);
      font-size: 16px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .flat-button-component:not(:last-child) {
        margin-right: 20px;
      }
    }
  }

  .sprime-panel__divider {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    height: 2px;
    width: 100%;
    background: var(--s-prime-panel__divider-background);
    flex-shrink: 0;
  }

  .sprime-panel__body {
    padding: 30px 50px;
    display: grid;
    grid-template-columns: 250px 1fr 280px 170px;

    .stats {
      display: flex;
      flex-direction: column;
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;
      padding-top: 10px;

      .stat {
        display: flex;
        flex-direction: column;
        margin-bottom: 18px;

        .stat__info-icon {
          margin-left: 6px;
        }

        .stat__title {
          display: flex;
          align-items: center;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--s-prime-panel__main-text-color);
        }

        .stat__value {
          font-size: 18px;
          font-weight: 500;
          color: var(--s-prime-panel__secondary-text-color);
        }

        .stat__extra-info {
          font-size: 14px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          margin-top: 4px;
        }
      }
    }

    .distribution {
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;
      padding-top: 10px;

      .distribution__title {
        color: var(--s-prime-panel__main-text-color);
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 10px;
        text-align: center;
      }

      .chart-container {
        display: flex;
        flex-direction: column;
        position: relative;
        margin: 0 auto;
        height: 160px;
        width: 280px;

        div {
          width: 100%;
          height: 100%;
        }

        .distribution-chart-line {
          flex-shrink: 0;
          width: calc(100% - 6px);
          margin: 0 auto 14px auto;
          height: 2px;
          background: linear-gradient(to right, var(--distribution-chart__line-background--1) 30%, var(--distribution-chart__line-background--2) 60%, var(--distribution-chart__line-background--3) 80%)
        }
      }
    }

    .governance {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 10px;

      .governance__title {
        margin-bottom: 20px;
        color: var(--s-prime-panel__main-text-color);
        font-size: 16px;
        font-weight: 500;
      }

      .power-gauge {
        position: relative;
        width: 160px;
        height: 160px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        box-shadow: var(--s-prime-panel__gauge-box-shadow);

        &:before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--s-prime-panel__gauge-border);
          border-radius: 50%;
          mask-image: radial-gradient(closest-side, transparent calc(100% - 2px), black calc(100% - 2px));
        }

        .gauge__value {
          font-size: 40px;
          font-weight: 600;
          color: var(--s-prime-panel__gauge-text-color);
        }
      }
    }

    .rates {
      padding-top: 10px;

      .rate {
        display: flex;
        flex-direction: column;

        &:not(:last-child) {
          margin-bottom: 30px;
        }

        .rate__title {
          font-size: 16px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          padding-bottom: 6px;
        }

        .rate__value {
          font-size: 18px;
          font-weight: 500;
          color: var(--s-prime-panel__secondary-text-color);

          &.governance-rate {
            &.negative {
              color: var(--currency-input__error-color);
            }
          }
        }

        .rate__extra-info {
          font-size: 14px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          margin-top: 4px;
        }
      }
    }
  }
}


</style>
