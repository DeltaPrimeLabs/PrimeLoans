<template>
  <div v-if="provider" class="penpie-lp-table-row-component">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <img class="asset__icon" :src="`src/assets/logo/${lpToken.assetLogoName.toLowerCase()}.png`">
        <div class="asset__info">
          <a class="asset__name" :href="lpToken.link" target="_blank">{{ lpToken.assetNameToDisplay }}
          </a>
          <div class="asset__dex">
            by {{ lpToken.dex }}
          </div>
        </div>
        <InfoIcon class="info__icon"
                  :tooltip="{content: `Maturity ${lpToken.maturity} - ${lpToken.maturityInDays} days`, classes: 'info-tooltip'}"
                  :classes="'info-tooltip'"></InfoIcon>
      </div>

      <div class="table__cell table__cell--double-value lp-balance">
        <template
          v-if="penpieLpBalances">
          <div class="double-value__pieces">
            {{ penpieLpBalances[lpToken.symbol] | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="penpieLpBalances">{{ penpieLpBalances[lpToken.symbol] * lpToken.price | usd }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value staked">
        <template
          v-if="penpieLpBalances">
          <div class="double-value__pieces">
            {{ penpieLpBalances[lpToken.symbol] * lpToken.price / assets[lpToken.asset].price | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="penpieLpBalances">{{ penpieLpBalances[lpToken.symbol] * lpToken.price | usd }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value">
        <template>
          <div class="table__cell rewards">
            <template v-if="lpToken.rewards && lpToken.rewards.length > 0">
              <span v-for="reward in lpToken.rewards">
                <img class="asset__icon" :src="getIcon(reward.asset, rewardsTokens[reward.asset].logoExt)">
                <span>{{ formatTokenBalanceWithLessThan(reward.amountFormatted, 4, true) }}</span>
              </span>
            </template>
            <div v-else class="no-value-dash"></div>
            <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
          </div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan" v-if="apys">
        {{ formatTvl(apys[lpToken.symbol].tvl) }}
      </div>

      <div class="table__cell capacity">
        <bar-gauge-beta v-if="lpToken.maxExposure" :min="0" :max="lpToken.maxExposure"
                        :value="Math.max(lpToken.currentExposure, 0.001)"
                        v-tooltip="{content: `${lpToken.currentExposure ? lpToken.currentExposure.toFixed(2) : 0} ($${lpToken.currentExposure ? (lpToken.currentExposure * this.lpToken.price).toFixed(2) : 0}) out of ${lpToken.maxExposure} ($${lpToken.maxExposure ? (lpToken.maxExposure * this.lpToken.price).toFixed(2) : 0}) is currently used.`, classes: 'info-tooltip'}"
                        :width="80"></bar-gauge-beta>
      </div>

      <div class="table__cell table__cell--double-value apr" v-bind:class="{'apr--with-warning': lpToken.aprWarning}">
        {{ apr / 100 | percent }}
        <div class="apr-warning" v-if="lpToken.aprWarning">
          <img src="src/assets/icons/warning.svg"
               v-tooltip="{content: lpToken.aprWarning, classes: 'info-tooltip long'}">
        </div>
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        <span>{{ (maxApr + boostApy) | percent }}<img v-if="boostApy"
                                                      v-tooltip="{content: `This pool is incentivized!<br>⁃ up to ${maxApr ? (maxApr * 100).toFixed(2) : 0}% Pool APR<br>⁃ up to ${boostApy ? (boostApy * 100).toFixed(2) : 0}% ${chain === 'arbitrum' ? 'ARB' : 'AVAX'} incentives`, classes: 'info-tooltip'}"
                                                      src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
          class="actions__icon-button"
          :config="addActionsConfig"
          v-if="addActionsConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons || noSmartLoan || !healthLoaded || isMatured(lpToken.maturity)">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
          class="actions__icon-button last"
          :config="removeActionsConfig"
          v-if="removeActionsConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons || noSmartLoan || !healthLoaded">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-if="moreActionsConfig"
          :config="moreActionsConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="disableAllButtons || noSmartLoan || !healthLoaded">
        </IconButtonMenuBeta>
      </div>

      <div class="table__cell"></div>
    </div>
  </div>
</template>

<script>
import AddFromWalletModal from './AddFromWalletModal.vue';

const ethers = require('ethers');
import DoubleAssetIcon from './DoubleAssetIcon.vue';
import Chart from './Chart.vue';
import IconButtonMenuBeta from './IconButtonMenuBeta.vue';
import SmallBlock from './SmallBlock.vue';
import {mapActions, mapState} from 'vuex';
import {calculateMaxApy} from '../utils/calculate';
import erc20ABI from '../abis/ERC20.json';
import config from '../config';
import TOKEN_ADDRESSES from '../../common/addresses/arbitrum/token_addresses.json';
import WithdrawModal from './WithdrawModal.vue';
import SwapModal from './SwapModal.vue';
import {BigNumber} from 'ethers';
import {wrapContract} from '../utils/blockchain';
import ClaimRewardsModal from './ClaimRewardsModal.vue';
import BarGaugeBeta from './BarGaugeBeta.vue';
import InfoIcon from './InfoIcon.vue';
import {ActionSection} from '../services/globalActionsDisableService';

export default {
  name: 'PenpieLpTableRow',
  components: {InfoIcon, BarGaugeBeta, SmallBlock, IconButtonMenuBeta, Chart, DoubleAssetIcon},
  props: {
    lpToken: null
  },
  data() {
    return {
      chain: null,
      addActionsConfig: null,
      removeActionsConfig: null,
      moreActionsConfig: null,
      disableAllButtons: true,
      isLpBalanceEstimated: false,
      healthLoaded: false,
      totalStaked: null,
      apr: 0,
      tvl: 0,
      boostApy: 0,
      rewards: null,
      rewardsTokens: {...config.ASSETS_CONFIG, ...config.PENPIE_REWARDS_TOKENS},
      isActionDisabledRecord: {},
    }
  },
  computed: {
    ...mapState('fundsStore', [
      'health',
      'lpAssets',
      'lpBalances',
      'smartLoanContract',
      'assetBalances',
      'assetAvailableBalances',
      'assets',
      'debtsPerAsset',
      'penpieLpBalances',
      'penpieLpAssets',
      'wombatLpAssets',
      'wombatLpBalances',
      'wombatYYFarmsBalances',
      'noSmartLoan',
      'concentratedLpAssets',
      'concentratedLpBalances',
      'levelLpAssets',
      'levelLpBalances',
      'traderJoeV2LpAssets',
      'balancerLpAssets',
      'balancerLpBalances',
      'gmxV2Assets',
      'gmxV2Balances',
      'fullLoanStatus',
      'apys',
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'lpService',
      'healthService',
      'providerService',
      'ltipService',
      'globalActionsDisableService'
    ]),
    maxApr() {
      return calculateMaxApy(this.pools, this.apr / 100);
    },
  },

  async mounted() {
    this.providerService.observeProviderCreated().subscribe(() => {
      this.chain = window.chain;
      this.setupAddActionsConfiguration();
      this.setupRemoveActionsConfiguration();
      this.setupMoreActionsConfiguration();
      this.watchAssetBalancesDataRefreshEvent();
      this.watchHardRefreshScheduledEvent();
      this.watchHealth();
      this.watchProgressBarState();
      this.watchAssetApysRefresh();
      this.watchExternalAssetBalanceUpdate();
      this.watchRefreshLP();
      this.watchAssetBalancesDataRefresh();
      this.watchLtipMaxBoostUpdate();
      this.setupMaturityInDays();
    })
    this.watchActionDisabling();
  },

  methods: {
    ...mapActions('fundsStore', [
      'fund',
      'withdraw',
      'createPendleLpFromLrt',
      'unwindPendleLpToLrt',
      'unstakeAndExportPendleLp',
      'depositPendleLPAndStake',
      'getPenpiePendingRewards',
      'claimPenpieRewards',
    ]),

    setupAddActionsConfiguration() {
      this.addActionsConfig = {
        iconSrc: 'src/assets/icons/plus.svg',
        tooltip: 'Add',
        menuOptions: [
          {
            key: 'ADD_FROM_WALLET',
            name: 'Import Penpie LP from wallet',
            disabled: this.isActionDisabledRecord['ADD_FROM_WALLET'] || this.disableAllButtons,
          },
          {
            key: 'IMPORT_AND_STAKE',
            name: 'Import & stake Pendle LP',
            disabled: this.isActionDisabledRecord['IMPORT_AND_STAKE'] || this.disableAllButtons,
          },
          {
            key: 'CREATE_LP',
            name: 'Create LP from LRT',
            disabled: this.isActionDisabledRecord['CREATE_LP'] || this.disableAllButtons,
          },
        ]
      }
    },

    setupRemoveActionsConfiguration() {
      this.removeActionsConfig = {
        iconSrc: 'src/assets/icons/minus.svg',
        tooltip: 'Remove',
        menuOptions: [
          {
            key: 'EXPORT_LP',
            name: 'Export Penpie LP',
            disabled: this.isActionDisabledRecord['EXPORT_LP'] || this.disableAllButtons,
          },
          {
            key: 'UNSTAKE_AND_EXPORT',
            name: 'Unstake & export Pendle LP',
            disabled: this.isActionDisabledRecord['UNSTAKE_AND_EXPORT'] || this.disableAllButtons,
          },
          {
            key: 'UNWIND',
            name: 'Unwind LP to LRT',
            disabled: this.isActionDisabledRecord['UNWIND'] || this.disableAllButtons,
          },
        ]
      }
    },

    setupMoreActionsConfiguration() {
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            key: 'CLAIM_REWARDS',
            name: 'Claim rewards',
            disabled: this.isActionDisabledRecord['CLAIM_REWARDS'] || !this.lpToken.rewards || this.lpToken.rewards.length === 0,
            disabledInfo: 'You don\'t have any claimable rewards yet.',
          }
        ]
      };
    },

    isMatured(maturity) {
      const [day, month, year] = maturity.split('/')
      const maturityDate = new Date(`${year}-${month}-${day}`)
      return maturityDate < new Date()
    },

    actionClick(key) {
      if (!this.disableAllButtons || this.noSmartLoan || !this.healthLoaded) {
        switch (key) {
          case 'ADD_FROM_WALLET':
            this.openAddFromWalletModal();
            break;
          case 'IMPORT_AND_STAKE':
            this.openImportAndStakeModal();
            break;
          case 'CREATE_LP':
            this.openStakeModal();
            break;
          case 'EXPORT_LP':
            this.openWithdrawModal();
            break;
          case 'UNSTAKE_AND_EXPORT':
            this.openUnstakeAndExportModal();
            break;
          case 'UNWIND':
            this.openUnwindModal();
            break;
          case 'CLAIM_REWARDS':
            this.openClaimRewardsModal();
            break;
        }
      }
    },

    async openAddFromWalletModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] ? this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.logo = config.PROTOCOLS_CONFIG['PENPIE'].logo;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();

      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const fundRequest = {
            value: addFromWalletEvent.value.toString(),
            asset: this.lpToken.symbol,
            assetDecimals: this.lpToken.decimals,
            type: 'PENPIE_LP',
          };
          this.handleTransaction(this.fund, {fundRequest: fundRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async openImportAndStakeModal() {
      const modalInstance = this.openModal(AddFromWalletModal);
      modalInstance.asset = {...this.lpToken, short: 'PENDLE LP'};
      modalInstance.title = 'Import and Stake LP';
      modalInstance.assetBalance = this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] ? this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.logo = config.PROTOCOLS_CONFIG['PENDLE'].logo;
      modalInstance.walletAssetBalance = await this.getWalletPendleLpBalance();

      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const depositAndStakeRequest = {
            market: this.lpToken.pendleLpAddress,
            amount: addFromWalletEvent.value,
            targetAsset: this.lpToken.symbol,
            sourceAsset: this.lpToken.pendleLpSymbol,
            decimals: this.lpToken.decimals,
          };
          this.handleTransaction(this.depositPendleLPAndStake, {depositAndStakeRequest: depositAndStakeRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    async openStakeModal() {
      const modalInstance = this.openModal(SwapModal);
      let initSourceAsset = this.lpToken.asset;

      modalInstance.title = 'Create LP from LRT';
      modalInstance.swapDex = 'Penpie';
      modalInstance.swapDebtMode = false;
      modalInstance.slippageMargin = 0;
      modalInstance.sourceAsset = initSourceAsset;
      modalInstance.sourceAssetBalance = this.assetAvailableBalances[initSourceAsset];
      modalInstance.assets = {...this.assets};
      modalInstance.sourceAssets = [initSourceAsset];
      modalInstance.targetAssetsConfig = {
        [this.lpToken.symbol]: this.penpieLpAssets[this.lpToken.symbol],
        'Penpie': this.penpieLpAssets[this.lpToken.symbol]
      };
      modalInstance.targetAssets = [this.lpToken.symbol];
      modalInstance.assetBalances = {...this.assetBalances, ...this.penpieLpBalances};
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.symbol;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.checkMarketDeviation = true;
      modalInstance.blockReversing = true;
      let responseGuessPtReceivedFromSy = undefined
      let responseInput = undefined
      let responseLimit = undefined

      modalInstance.queryMethods = {
        Penpie: async (sourceAsset, targetAsset, amountIn) => {
          const queryParams = new URLSearchParams({
            chainId: '42161',
            receiverAddr: this.smartLoanContract.address,
            marketAddr: this.lpToken.pendleLpAddress,
            tokenInAddr: TOKEN_ADDRESSES[this.lpToken.asset],
            amountTokenIn: amountIn,
            slippage: '0.0001',
          });

          const {
            contractCallParams: {
              2: minLpOut,
              3: guessPtReceivedFromSy,
              4: input,
              5: limit
            }
          } = await (await fetch(`${config.pendleApiBaseUrl}/v1/addLiquiditySingleToken?${queryParams}`)).json();
          responseGuessPtReceivedFromSy = guessPtReceivedFromSy;
          responseInput = input;
          responseLimit = limit;
          return BigNumber.from(minLpOut);
        },
      };

      modalInstance.customTargetValidators = [
        {
          validate: async (value) => {
            if (!responseGuessPtReceivedFromSy || !responseInput || !responseLimit) {
              return '';
            }
          }
        }
      ]
      modalInstance.initiate();
      modalInstance.$on('SWAP', swapEvent => {
        const stakeRequest = {
          sourceAsset: swapEvent.sourceAsset,
          targetAsset: swapEvent.targetAsset,
          amount: swapEvent.sourceAmount,
          market: this.lpToken.pendleLpAddress,
          minLpOut: swapEvent.targetAmount,
          guessPtReceivedFromSy: responseGuessPtReceivedFromSy,
          input: responseInput,
          limit: responseLimit,
        };

        this.handleTransaction(this.createPendleLpFromLrt, {stakeRequest: stakeRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async openUnwindModal() {
      const modalInstance = this.openModal(SwapModal);
      let initSourceAsset = this.lpToken.symbol;

      modalInstance.title = 'Unwind LP to LRT';
      modalInstance.swapDex = 'Penpie';
      modalInstance.sourceAssetNameToDisplay = 'Penpie';
      modalInstance.swapDebtMode = false;
      modalInstance.slippageMargin = 0;
      modalInstance.sourceAsset = initSourceAsset;
      modalInstance.sourceAssetBalance = this.penpieLpBalances[initSourceAsset];
      modalInstance.sourceAssets = [initSourceAsset];
      modalInstance.sourceAssetsConfig = config.PENPIE_LP_ASSETS_CONFIG;
      modalInstance.assets = {...this.assets};
      modalInstance.targetAssetsConfig = {
        [this.lpToken.asset]: config.ASSETS_CONFIG[this.lpToken.asset]
      };
      modalInstance.targetAssets = [this.lpToken.asset];
      modalInstance.assetBalances = {...this.assetBalances, ...this.penpieLpBalances};
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.farms = this.farms;
      modalInstance.targetAsset = this.lpToken.asset;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.checkMarketDeviation = true;
      modalInstance.blockReversing = true;
      let responseOutput = undefined
      let responseLimit = undefined

      modalInstance.queryMethods = {
        Penpie: async (sourceAsset, targetAsset, amountIn) => {
          const queryParams = new URLSearchParams({
            chainId: '42161',
            receiverAddr: this.smartLoanContract.address,
            marketAddr: this.lpToken.pendleLpAddress,
            tokenOutAddr: TOKEN_ADDRESSES[this.lpToken.asset],
            amountLpToRemove: amountIn,
            slippage: '0.0001'
          });

          const {
            contractCallParams: {
              3: output,
              4: limit,
            }
          } = await (await fetch(`${config.pendleApiBaseUrl}/v1/removeLiquiditySingleToken?${queryParams}`)).json();
          responseOutput = output;
          responseLimit = limit;
          return BigNumber.from(output.minTokenOut);
        },
      };

      modalInstance.customTargetValidators = [
        {
          validate: async () => {
            if (!responseOutput || !responseLimit) {
              return '';
            }
          }
        }
      ]
      modalInstance.initiate();
      modalInstance.$on('SWAP', swapEvent => {
        const unwindRequest = {
          sourceAsset: swapEvent.sourceAsset,
          targetAsset: swapEvent.targetAsset,
          amount: swapEvent.sourceAmount,
          market: this.lpToken.pendleLpAddress,
          minOut: swapEvent.targetAmount,
          output: responseOutput,
          limit: responseLimit,
        };

        this.handleTransaction(this.unwindPendleLpToLrt, {unwindRequest: unwindRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    openUnstakeAndExportModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = {...this.lpToken, short: 'PENDLE LP', name: 'Pendle LP'};
      modalInstance.assetBalance = this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] ? this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.farms = this.farms;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.logo = config.PROTOCOLS_CONFIG['PENDLE'].logo;
      modalInstance.showTopDescription = false;

      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const value = Number(withdrawEvent.value).toFixed(config.DECIMALS_PRECISION);
        const unstakeRequest = {
          market: this.lpToken.pendleLpAddress,
          asset: this.lpToken.symbol,
          value: value,
          assetDecimals: this.lpToken.decimals,
        };
        this.handleTransaction(this.unstakeAndExportPendleLp, {unstakeRequest: unstakeRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        })
          .then(() => {
          });
      });
    },

    openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = this.lpToken;
      modalInstance.assetBalance = this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] ? this.penpieLpBalances && this.penpieLpBalances[this.lpToken.protocolIdentifier] : 0;
      modalInstance.assets = this.assets;
      modalInstance.assetBalances = this.assetBalances;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.lpAssets = this.lpAssets;
      modalInstance.concentratedLpAssets = this.concentratedLpAssets;
      modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
      modalInstance.levelLpAssets = this.levelLpAssets;
      modalInstance.levelLpBalances = this.levelLpBalances;
      modalInstance.lpBalances = this.lpBalances;
      modalInstance.concentratedLpBalances = this.concentratedLpBalances;
      modalInstance.gmxV2Assets = this.gmxV2Assets;
      modalInstance.gmxV2Balances = this.gmxV2Balances;
      modalInstance.balancerLpBalances = this.balancerLpBalances;
      modalInstance.balancerLpAssets = this.balancerLpAssets;
      modalInstance.penpieLpAssets = this.penpieLpAssets;
      modalInstance.penpieLpBalances = this.penpieLpBalances;
      modalInstance.wombatLpAssets = this.wombatLpAssets;
      modalInstance.wombatLpBalances = this.wombatLpBalances;
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.farms = this.farms;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.logo = config.PROTOCOLS_CONFIG['PENPIE'].logo;
      modalInstance.showTopDescription = false;

      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const value = Number(withdrawEvent.value).toFixed(config.DECIMALS_PRECISION);
        const withdrawRequest = {
          asset: this.lpToken.symbol,
          value: value,
          assetDecimals: this.lpToken.decimals,
          type: 'PENPIE_LP',
        };
        this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        })
          .then(() => {
          });
      });
    },

    openClaimRewardsModal() {
      const modalInstance = this.openModal(ClaimRewardsModal);
      modalInstance.totalRewards = this.lpToken.rewards.map(reward => ({
        symbol: reward.asset,
        amount: reward.amountFormatted,
      }))
      modalInstance.header = 'Claim Penpie rewards'
      modalInstance.tokensConfig = {...config.PENPIE_REWARDS_TOKENS, ...config.ASSETS_CONFIG}

      modalInstance.$on('CLAIM', () => {
        if (this.smartLoanContract) {
          this.handleTransaction(this.claimPenpieRewards, {market: this.lpToken.pendleLpAddress}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    async getWalletAssetBalance() {
      const tokenContract = new ethers.Contract(this.lpToken.receiptTokenAddress ? this.lpToken.receiptTokenAddress : this.lpToken.address, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, this.lpToken.decimals);
    },

    async getWalletPendleLpBalance() {
      const tokenContract = new ethers.Contract(this.lpToken.pendleLpAddress ? this.lpToken.pendleLpAddress : this.lpToken.address, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, this.lpToken.decimals);
    },

    async setupApr() {
      this.apr = this.apys[this.lpToken.symbol] ? this.apys[this.lpToken.symbol].lp_apy * 100 : 0;
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe(() => {
        this.isLpBalanceEstimated = false;
        this.disableAllButtons = false;
        this.$forceUpdate();
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.disableAllButtons = true;
        this.$forceUpdate();
      });
    },

    watchHealth() {
      this.healthService.observeHealth().subscribe(health => {
        this.healthLoaded = true;
      });
    },

    watchAssetApysRefresh() {
      this.dataRefreshEventService.observeAssetApysDataRefresh().subscribe(async () => {
        await this.setupApr();
      })
    },

    watchExternalAssetBalanceUpdate() {
      this.assetBalancesExternalUpdateService.observeExternalAssetBalanceUpdate().subscribe(updateEvent => {
        if (updateEvent.assetSymbol === this.lpToken.symbol) {
          this.balancerLpBalances[this.lpToken.symbol] = updateEvent.balance;
          this.isBalanceEstimated = !updateEvent.isTrueData;
          this.$forceUpdate();
        }
      })
    },

    watchRefreshLP() {
      this.lpService.observeRefreshLp().subscribe(async (lpType) => {
        if (lpType === 'PENPIE_LP') {
          this.setupMoreActionsConfiguration();
        }
      })
    },

    watchAssetBalancesDataRefresh() {
      this.dataRefreshEventService.observeAssetBalancesDataRefresh().subscribe(() => {
        this.disableAllButtons = !this.penpieLpBalances || !this.penpieLpBalances[this.lpToken.protocolIdentifier];
        this.setupAddActionsConfiguration();
        this.setupRemoveActionsConfiguration();
      })
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe((state) => {
        switch (state) {
          case 'MINING' : {
            this.disableAllButtons = true;
            break;
          }
          case 'SUCCESS': {
            this.disableAllButtons = false;
            break;
          }
          case 'ERROR' : {
            this.disableAllButtons = false;
            this.isBalanceEstimated = false;
            break;
          }
          case 'CANCELLED' : {
            this.disableAllButtons = false;
            this.isBalanceEstimated = false;
            break;
          }
        }
      })
    },

    watchLtipMaxBoostUpdate() {
      this.ltipService.observeLtipMaxBoostApy().subscribe((boostApy) => {
        this.boostApy = boostApy;
      });
    },

    handleTransactionError(error) {
      if (error.code === 404) {
        this.progressBarService.emitProgressBarErrorState('Action is currently disabled')
      }
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isBalanceEstimated = false;
    },

    setupMaturityInDays() {
      const now = new Date();
      const day = Number(this.lpToken.maturity.split('/')[0]);
      const month = Number(this.lpToken.maturity.split('/')[1]);
      const year = Number(this.lpToken.maturity.split('/')[2]);
      const date = new Date(year, month - 1, day);
      const diffTime = Math.abs(date - now);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      this.lpToken.maturityInDays = diffDays;
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.PENPIE)
        .subscribe(isActionDisabledRecord => {
          this.isActionDisabledRecord = isActionDisabledRecord;
          this.setupAddActionsConfiguration();
          this.setupRemoveActionsConfiguration();
          this.setupMoreActionsConfiguration();
        })
    },
  }
}
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.penpie-lp-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.expanded {
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: 105px 130px 130px 1fr 80px 120px 110px 100px 40px 80px 22px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__name {
          color: var(--default-text-color);
        }

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }

        .asset__info {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;

          .info__icon {
            position: absolute;
            top: 22px;
            right: -19px;
          }
        }

        .asset__dex {
          display: flex;
          flex-direction: row;
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);
        }
      }

      &.lp-balance, &.staked {
        align-items: flex-end;
      }

      &.loan, &.apr, &.max-apr {
        align-items: flex-end;
      }

      &.rewards {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        .asset__icon {
          margin-left: 8px;
          height: 22px;
          width: 22px;
          border-radius: 50%;
        }
      }

      &.apr.apr--with-warning {
        position: relative;

        .apr-warning {
          position: absolute;
          right: 52px;
        }
      }

      &.max-apr {
        font-weight: 600;
      }

      &.trend {
        justify-content: center;
        align-items: center;
        margin-left: 49px;

        .trend__chart-change {
          display: flex;
          flex-direction: column;
          font-size: $font-size-xxs;
          align-items: center;
          cursor: pointer;
        }

        .chart__icon-button {
          margin-left: 7px;
        }
      }

      &.capacity {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
      }

      .stars-icon {
        width: 20px;
        margin-right: 10px;
        transform: translateY(-2px);
      }

      &.price {
        justify-content: flex-end;
        align-items: center;
        font-weight: 500;
      }

      &.actions {
        align-items: center;

        .actions__icon-button {
          &:not(:last-child) {
            margin-right: 12px;
          }
        }
      }

      &.table__cell--double-value {
        flex-direction: column;
        justify-content: center;

        .double-value__pieces {
          font-size: $font-size-xsm;
          font-weight: 600;
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__double-value-color);
          font-weight: 500;
        }

        &.loan {
          .double-value__pieces {
            font-weight: 500;
          }
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: var(--asset-table-row__no-value-dash-color);
      }
    }
  }
}
</style>

<style lang="scss">
.penpie-lp-table-row-component {
  .table__row {
    .bar-gauge-beta-component .bar-gauge .bar {
      width: 80px;
    }
  }
}
</style>
