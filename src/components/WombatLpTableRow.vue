<template>
  <div v-if="provider" class="wombat-lp-table-row-component"
       v-bind:class="{'wombat-lp-table-row-component--last': last}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(lpToken.name)">
        <div class="asset__info">
          <div class="asset__name">{{ lpToken.name }}
          </div>
          <div class="asset__dex">
            by Wombat
          </div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value lp-balance">
        <template
            v-if="wombatLpBalances">
          <div class="double-value__pieces">
            {{ wombatLpBalances[lpToken.symbol] | smartRound }}
          </div>
          <div class="double-value__usd">
            <span v-if="wombatLpBalances">{{
                wombatLpBalances[lpToken.symbol] * wombatLpAssets[lpToken.symbol].price | usd
              }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value staked">
        <template
            v-if="wombatLpBalances">
          <div class="double-value__pieces">
            {{
              wombatLpBalances[lpToken.symbol] * wombatLpAssets[lpToken.symbol].price / assets[lpToken.asset].price | smartRound
            }}
          </div>
          <div class="double-value__usd">
            <span v-if="wombatLpBalances">{{
                wombatLpBalances[lpToken.symbol] * wombatLpAssets[lpToken.symbol].price | usd
              }}</span>
          </div>
        </template>
        <template v-else>
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value">
        <template>
          <div class="table__cell rewards">
            <template
                v-if="wombatLpAssets && wombatLpAssets[lpToken.symbol].rewards && wombatLpAssets[lpToken.symbol].rewards.length > 0">
              <span v-for="reward in wombatLpAssets[lpToken.symbol].rewards">
                <img class="asset__icon" :src="getIcon(reward.asset, rewardsTokens[reward.asset].logoExt)">
                <span>{{ formatTokenBalanceWithLessThan(reward.amountFormatted, 4, true) }}</span>
              </span>
            </template>
            <div v-else class="no-value-dash"></div>
            <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
          </div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value">
        <template>
          <div class="table__cell ggp-collected">
            <template
                v-if="collectedGGP !== null && lpToken.boostGGP">
              <span>
                <img class="asset__icon" :src="getIcon('GGP', rewardsTokens['GGP'].logoExt)">
                <span>{{ formatTokenBalanceWithLessThan(collectedGGP, 4, true) }}</span>
              </span>
            </template>
            <div v-else class="no-value-dash"></div>
            <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
          </div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value loan" v-if="apys">
        {{ formatTvl(apys[lpToken.apyKey].lp_tvl) }}
      </div>

      <!--      <div class="table__cell capacity" v-if="wombatLpAssets">-->
      <!--        <bar-gauge-beta v-if="wombatLpAssets[lpToken.symbol].maxExposure" :min="0" :max="wombatLpAssets[lpToken.symbol].maxExposure" :value="Math.max(wombatLpAssets[lpToken.symbol].currentExposure, 0.001)" v-tooltip="{content: `${wombatLpAssets[lpToken.symbol].currentExposure ? wombatLpAssets[lpToken.symbol].currentExposure.toFixed(2) : 0} ($${wombatLpAssets[lpToken.symbol].currentExposure ? (wombatLpAssets[lpToken.symbol].currentExposure * wombatLpAssets[lpToken.symbol].price).toFixed(2) : 0}) out of ${wombatLpAssets[lpToken.symbol].maxExposure} ($${wombatLpAssets[lpToken.symbol].maxExposure ? (wombatLpAssets[lpToken.symbol].maxExposure * wombatLpAssets[lpToken.symbol].price).toFixed(2) : 0}) is currently used.`, classes: 'info-tooltip'}" :width="80"></bar-gauge-beta>-->
      <!--      </div>-->

      <div class="table__cell table__cell--double-value apr" v-bind:class="{'apr--with-warning': lpToken.aprWarning}">
        {{ apr / 100 | percent }}
        <div class="apr-warning" v-if="lpToken.aprWarning && apr !== 0">
          <img src="src/assets/icons/warning.svg"
               v-tooltip="{content: lpToken.aprWarning, classes: 'info-tooltip long'}">
        </div>
      </div>

      <div class="table__cell table__cell--double-value max-apr">
        <span v-if="lpToken.boostGGP">{{ (maxApr + 4.5 * boostApy) | percent }}<img v-if="boostApy"
                                                      v-tooltip="{content: `This pool is incentivized!<br>⁃ up to ${maxApr ? (maxApr * 100).toFixed(2) : 0}% Pool APR<br>⁃ up to ${boostApy ? (4.5 * boostApy * 100).toFixed(2) : 0}% GGP incentives`, classes: 'info-tooltip'}"
                                                      src="src/assets/icons/stars.png" class="stars-icon"></span>
        <span v-if="!lpToken.boostGGP">{{ maxApr | percent }}</span>
      </div>

      <div class="table__cell"></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
            class="actions__icon-button"
            :config="addActionsConfig"
            v-if="addActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="disableAllButtons || noSmartLoan || !healthLoaded">
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
import AddFromWalletModal from "./AddFromWalletModal.vue";

const ethers = require('ethers');
import DoubleAssetIcon from "./DoubleAssetIcon.vue";
import Chart from "./Chart.vue";
import IconButtonMenuBeta from "./IconButtonMenuBeta.vue";
import SmallBlock from "./SmallBlock.vue";
import {mapActions, mapState} from "vuex";
import {calculateMaxApy, formatUnits} from "../utils/calculate";
import erc20ABI from "../../test/abis/ERC20.json";
import config from "../config";
import TOKEN_ADDRESSES from "../../common/addresses/arbitrum/token_addresses.json";
import WithdrawModal from "./WithdrawModal.vue";
import SwapModal from "./SwapModal.vue";
import {BigNumber} from "ethers";
import {wrapContract} from "../utils/blockchain";
import ClaimRewardsModal from "./ClaimRewardsModal.vue";
import BarGaugeBeta from './BarGaugeBeta.vue';
import ABI_WOMBAT_DYNAMIC_POOL_V2 from "../abis/WombatDynamicPoolV2.json";
import { ActionSection } from "../services/globalActionsDisableService";

export default {
  name: 'WombatLpTableRow',
  components: {BarGaugeBeta, SmallBlock, IconButtonMenuBeta, Chart, DoubleAssetIcon},
  props: {
    lpToken: null,
    last: null,
  },
  data() {
    return {
      addActionsConfig: null,
      removeActionsConfig: null,
      moreActionsConfig: null,
      disableAllButtons: true,
      isLpBalanceEstimated: false,
      healthLoaded: false,
      totalStaked: null,
      apr: 0,
      tvl: 0,
      rewards: null,
      rewardsTokens: {...config.ASSETS_CONFIG, ...config.WOMBAT_REWARDS_TOKENS},
      contract: null,
      collectedGGP: null,
      boostApy: null,
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
      'assets',
      'debtsPerAsset',
      'penpieLpBalances',
      'penpieLpAssets',
      'wombatLpBalances',
      'wombatLpAssets',
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
      'ggpIncentivesService',
    ]),
    maxApr() {
      return calculateMaxApy(this.pools, this.apr / 100);
    },
  },

  async mounted() {
    this.providerService.observeProviderCreated().subscribe(() => {
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
      this.createContractObject();
      this.watchGgpIncentives();
    })
  },

  methods: {
    ...mapActions('fundsStore', [
      'fund',
      'withdraw',
      'createWombatLpFromLrt',
      'unwindWombatLpToLrt',
      'depositWombatLPAndStake',
      'unstakeAndExportWombatLp',
      'claimWombatRewards',
    ]),

    setupAddActionsConfiguration() {
      this.addActionsConfig = {
        iconSrc: 'src/assets/icons/plus.svg',
        tooltip: 'Add',
        menuOptions: [
          {
            key: 'ADD_FROM_WALLET',
            name: 'Import existing LP position',
            disabled: true,
          },
          // {
          //   key: 'IMPORT_AND_STAKE',
          //   name: 'Import & stake Pendle LP',
          //   disabled: this.disableAllButtons,
          // },
          {
            key: 'CREATE_LP',
            name: 'Create LP position',
            disabled: true,
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
            name: 'Export LP position',
            disabled: true,
          },
          // {
          //   key: 'UNSTAKE_AND_EXPORT',
          //   name: 'Unstake & export Pendle LP',
          //   disabled: this.disableAllButtons,
          // },
          {
            key: 'UNWIND',
            name: 'Unwind LP position',
            disabled: true,
          },
        ]
      }
    },

    setupMoreActionsConfiguration() {
      const rewards = this.wombatLpAssets && this.wombatLpAssets[this.lpToken.symbol].rewards
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            key: 'CLAIM_REWARDS',
            name: 'Claim rewards',
            disabled: true,
            disabledInfo: 'You don\'t have any claimable rewards yet.',
          }
        ]
      };
    },

    actionClick(key) {
      if (!this.isActionDisabledRecord[key] && (!this.disableAllButtons || this.noSmartLoan || !this.healthLoaded)) {
        switch (key) {
          case 'ADD_FROM_WALLET':
            this.openAddFromWalletModal();
            break;
            // case 'IMPORT_AND_STAKE':
            //   this.openImportAndStakeModal();
            //   break;
          case 'CREATE_LP':
            this.openStakeModal();
            break;
          case 'EXPORT_LP':
            this.openWithdrawModal();
            break;
            // case 'UNSTAKE_AND_EXPORT':
            //   this.openUnstakeAndExportModal();
            //   break;
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
      modalInstance.asset = {...this.lpToken, ...this.wombatLpAssets[this.lpToken.symbol]};
      modalInstance.assetBalance = this.wombatLpBalances && this.wombatLpBalances[this.lpToken.symbol] ? this.wombatLpBalances[this.lpToken.symbol] : 0;
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
      modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
      modalInstance.farms = this.farms;
      modalInstance.debtsPerAsset = this.debtsPerAsset;
      modalInstance.loan = this.debt;
      modalInstance.thresholdWeightedValue = this.thresholdWeightedValue;
      modalInstance.logo = config.PROTOCOLS_CONFIG['WOMBAT'].logo;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();

      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        if (this.smartLoanContract) {
          const depositAndStakeRequest = {
            amount: addFromWalletEvent.value.toString(),
            asset: this.lpToken.symbol,
            assetDecimals: this.lpToken.decimals,
            depositAndStakeMethod: this.lpToken.depositAndStakeMethod,
          };
          this.handleTransaction(this.depositWombatLPAndStake, {depositAndStakeRequest: depositAndStakeRequest}, () => {
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

      modalInstance.title = 'Create LP';
      modalInstance.swapDex = 'Wombat';
      modalInstance.swapDebtMode = false;
      modalInstance.slippageMargin = 0;
      modalInstance.sourceAsset = initSourceAsset;
      modalInstance.sourceAssetBalance = this.assetBalances[initSourceAsset];
      modalInstance.assets = this.assets;
      modalInstance.sourceAssets = [initSourceAsset];
      modalInstance.targetAssetsConfig = config.WOMBAT_LP_ASSETS;
      modalInstance.targetAssets = [this.lpToken.symbol];
      modalInstance.assetBalances = {...this.assetBalances, ...this.wombatLpBalances};
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

      modalInstance.queryMethods = {
        Wombat: async (sourceAsset, targetAsset, amountIn) => {
          const sourceAssetAddress = config.ASSETS_CONFIG[sourceAsset].address
          const [minOut] = await this.contract.quotePotentialDeposit(sourceAssetAddress, amountIn)
          return minOut;
        },
      };
      modalInstance.initiate();
      modalInstance.$on('SWAP', swapEvent => {
        const stakeRequest = {
          sourceAsset: swapEvent.sourceAsset,
          targetAsset: swapEvent.targetAsset,
          amount: swapEvent.sourceAmount,
          minLpOut: swapEvent.targetAmount,
          methodName: this.lpToken.depositMethod,
        };

        this.handleTransaction(this.createWombatLpFromLrt, {stakeRequest: stakeRequest}, () => {
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

      modalInstance.title = 'Unwind LP';
      modalInstance.swapDex = 'Wombat';
      modalInstance.sourceAssetNameToDisplay = 'Wombat';
      modalInstance.swapDebtMode = false;
      modalInstance.slippageMargin = 0;
      modalInstance.sourceAsset = initSourceAsset;
      modalInstance.sourceAssetBalance = this.wombatLpBalances[initSourceAsset];
      modalInstance.sourceAssets = [initSourceAsset];
      modalInstance.sourceAssetsConfig = config.WOMBAT_LP_ASSETS;
      modalInstance.assets = this.assets;
      modalInstance.targetAssetsConfig = {
        [this.lpToken.asset]: config.ASSETS_CONFIG[this.lpToken.asset]
      };
      modalInstance.targetAssets = [this.lpToken.asset];
      modalInstance.assetBalances = {...this.assetBalances, ...this.wombatLpBalances};
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

      modalInstance.queryMethods = {
        Wombat: async (sourceAsset, targetAsset, amountIn) => {
          const sourceAssetAddress = config.ASSETS_CONFIG[targetAsset].address
          const [minOut] = await this.contract.quotePotentialWithdraw(sourceAssetAddress, amountIn)
          return minOut;
        },
      };

      modalInstance.initiate();
      modalInstance.$on('SWAP', swapEvent => {
        const unwindRequest = {
          sourceAsset: swapEvent.sourceAsset,
          targetAsset: swapEvent.targetAsset,
          amount: swapEvent.sourceAmount,
          minOut: swapEvent.targetAmount,
          methodName: this.lpToken.withdrawMethod,
        };

        this.handleTransaction(this.unwindWombatLpToLrt, {unwindRequest: unwindRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    openWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = {...this.lpToken, price: this.wombatLpAssets[this.lpToken.symbol].price};
      modalInstance.assetBalance = this.wombatLpBalances && this.wombatLpBalances[this.lpToken.symbol] ? this.wombatLpBalances && this.wombatLpBalances[this.lpToken.symbol] : 0;
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
      modalInstance.logo = config.PROTOCOLS_CONFIG['WOMBAT'].logo;
      modalInstance.showTopDescription = false;
      modalInstance.hideToggle = true;

      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const value = Number(withdrawEvent.value).toFixed(config.DECIMALS_PRECISION);
        const unstakeRequest = {
          asset: this.lpToken.symbol,
          value: value,
          assetDecimals: this.lpToken.decimals,
          unstakeAndWithdrawMethod: this.lpToken.unstakeAndWithdrawMethod,
          type: 'WOMBAT_LP',
        };
        this.handleTransaction(this.unstakeAndExportWombatLp, {unstakeRequest: unstakeRequest}, () => {
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
      modalInstance.totalRewards = Object.values(this.wombatLpAssets).map(asset => asset.rewards).reduce((totalRewards, rewards) => {
        rewards.forEach(asset => {
          const foundIndex = totalRewards.findIndex(reward => reward.symbol === asset.asset)
          if (foundIndex < 0) {
            totalRewards.push({
              symbol: asset.asset,
              amount: asset.amountFormatted,
            })
          } else {
            totalRewards[foundIndex].amount += asset.amountFormatted
          }
        })
        return totalRewards
      }, [])
      modalInstance.header = 'Claim Wombat rewards'
      modalInstance.tokensConfig = {...config.WOMBAT_REWARDS_TOKENS, ...config.ASSETS_CONFIG}

      modalInstance.$on('CLAIM', () => {
        if (this.smartLoanContract) {
          this.handleTransaction(this.claimWombatRewards, {}, () => {
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
      const tokenContract = new ethers.Contract(this.lpToken.address, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, config.WOMBAT_LP_ASSETS[this.lpToken.symbol].decimals);
    },

    async getWalletPendleLpBalance() {
      const tokenContract = new ethers.Contract(this.lpToken.stakingContractAddress ? this.lpToken.stakingContractAddress : this.lpToken.address, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.lpToken.symbol, tokenContract, this.lpToken.decimals);
    },

    async setupApr() {
      this.apr = this.apys[this.lpToken.apyKey] ? this.apys[this.lpToken.apyKey].lp_apy * 100 + (this.lpToken.addTokenApy ? this.apys[this.lpToken.asset].apy : 0) : 0;
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

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.WOMBAT_LP)
      .subscribe(isActionDisabledRecord => {
        this.isActionDisabledRecord = isActionDisabledRecord;
        this.setupAddActionsConfiguration();
        this.setupRemoveActionsConfiguration();
        this.setupMoreActionsConfiguration();
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
        if (lpType === 'WOMBAT_LP') {
          this.setupMoreActionsConfiguration();
        }
      })
    },

    watchAssetBalancesDataRefresh() {
      this.dataRefreshEventService.observeAssetBalancesDataRefresh().subscribe(() => {
        this.disableAllButtons = !this.wombatLpBalances || !this.wombatLpBalances[this.lpToken.symbol];
        this.setupAddActionsConfiguration();
        this.setupRemoveActionsConfiguration();
        this.setupMoreActionsConfiguration();
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

    async createContractObject() {
      this.contract = await new ethers.Contract(this.lpToken.poolAddress, ABI_WOMBAT_DYNAMIC_POOL_V2, provider.getSigner());
    },

    watchGgpIncentives() {
      this.ggpIncentivesService.collectedGGP$.subscribe(collected => {
        this.collectedGGP = collected;
        setTimeout(() => {
          this.$forceUpdate();
        });
      });
      this.ggpIncentivesService.boostGGPApy$.subscribe(boost => {
        this.boostApy = boost ? boost.boostApy * this.assets['GGP'].price : 0;
        setTimeout(() => {
          this.$forceUpdate();
        });
      });
    }
  }
}
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.wombat-lp-table-row-component {
  height: 60px;
  transition: all 200ms;

  &.wombat-lp-table-row-component--last .table__row {
    border-image-source: none !important;
    border-color: transparent;
  }

  &.expanded {
    height: 387px;
  }

  .table__row {
    display: grid;
    grid-template-columns: 140px 125px 125px 1fr 140px 65px 110px 110px 30px 80px 22px;
    //grid-template-columns: 130px 120px 140px 1fr 70px 120px 110px 100px 30px 80px 22px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 1px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }

        .asset__dex {
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

      &.rewards, &.ggp-collected {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        .asset__icon {
          margin-left: 12px;
          height: 22px;
          width: 22px;
          border-radius: 50%;
        }
      }

      &.apr.apr--with-warning {
        position: relative;

        .apr-warning {
          position: absolute;
          left: 38px;
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
.wombat-lp-table-row-component {
  .table__row {
    .bar-gauge-beta-component .bar-gauge .bar {
      width: 80px;
    }
  }
}
</style>
