<template>
  <div class="staking-farm-table-row-component" v-if="farm">
    <div class="protocol-banner" v-if="farm.banner">
      {{ farm.banner }}
    </div>

    <div class="table__row">
      <div class="table__cell farm-cell">
        <div class="farm">
          <img class="protocol__icon" :src="`src/assets/logo/${protocolLogo(farm.protocol)}`">
          <div class="protocol__details">
            <div class="asset-name">
              {{ farm.name }}
              <img style="margin-left: 5px"
                   v-if="farm.droppingSupport && underlyingTokenStaked > 0"
                   src="src/assets/icons/warning.svg"
                   v-tooltip="{content: `We will drop support to this asset on ${ farm.debtCoverage > 0.1 ? '26.04.2024 12:00 CET' : 'Monday 22.04.2024 16:00 CET'}. Please withdraw or swap to another token.`, classes: 'info-tooltip long'}">
              <InfoIcon
                  class="info__icon"
                  v-if="farm.info"
                  :tooltip="{content: farm.info, classes: 'info-tooltip long', placement: 'right'}"
              ></InfoIcon>
            </div>
            <div class="by-farm">Yield Yak -> Wombat</div>
          </div>
        </div>
        <img src="src/assets/icons/icon_circle_star.svg" v-if="farm.earlyAccessRequired"
             v-tooltip="{content: 'Early Access is available exclusively for users holding $100 or more in $sPRIME.', classes: 'info-tooltip long'}"/>
      </div>

      <div class="table__cell">
        <div class="double-value staked-balance">
          <div class="double-value__pieces">
            {{ formatTokenBalanceWithLessThan(totalStaked, 8) }}
          </div>
          <div class="double-value__usd">{{ totalStaked * wombatLpAssets[farm.lpAssetToken].price | usd }}</div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value">
        <template>
          <div class="table__cell ggp-collected">
            <template
                v-if="collectedGGP !== null && farm.boostGGP">
              <span>
                <img src="src/assets/icons/warning.svg" v-tooltip="{content: `Rewards are being weekly recalculated based on on-chain data. The rewards shown here highly deviate from the real data.`, classes: 'info-tooltip long'}">
                <img v-if="ggpConfig" class="asset__icon" :src="getIcon('GGP', ggpConfig.logoExt)">
                <span>{{ formatTokenBalanceWithLessThan(collectedGGP / 30, 4, true) }}</span>
              </span>
            </template>
            <div v-else class="no-value-dash"></div>
            <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
          </div>
        </template>
      </div>

      <div class="table__cell apy">
        <div class="apr-warning" v-if="farm.aprWarning">
          <img src="src/assets/icons/warning.svg" v-tooltip="{content: `APR value is updated twice a day. Please check Yield Yak website to find the current pool's APR.`, classes: 'info-tooltip long'}">
        </div>
        {{ (apys[farm.lpAssetToken][farm.apyKey] + (farm.apyToAdd ? assets[farm.apyToAdd].apy : 0)) / 100 | percent }}
      </div>

      <div class="table__cell max-apy">
        <span>{{ maxApy | percent }}<img v-if="boostApy"
                                                      v-tooltip="{content: `This pool is incentivized!<br>⁃ up to ${maxApy ? (maxApy * 100).toFixed(2) : 0}% Pool APR<br>⁃ up to ${boostApy ? (boostApy * 100).toFixed(2) : 0}% ${chain === 'arbitrum' ? 'ARB' : 'AVAX'} incentives`, classes: 'info-tooltip'}"
                                                      src="src/assets/icons/stars.png" class="stars-icon"></span>
      </div>

      <div class="table__cell">
        <div class="actions">
          <IconButtonMenuBeta
              class="actions__icon-button"
              :config="addActionsConfig"
              v-if="addActionsConfig"
              v-on:iconButtonClick="actionClick"
              :disabled="disableAllButtons || platypusAffected || platypusAffectedDisableDeposit || noSmartLoan || !hasEarlyAccess">
          </IconButtonMenuBeta>
          <IconButtonMenuBeta
              class="actions__icon-button last"
              :config="removeActionsConfig"
              v-if="removeActionsConfig"
              v-on:iconButtonClick="actionClick"
              :disabled="disableAllButtons || platypusAffected || noSmartLoan || !hasEarlyAccess">
          </IconButtonMenuBeta>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import StakeModal from './StakeModal';
import UnstakeModal from './UnstakeModal';
import {mapState, mapActions} from 'vuex';
import config from '../config';
import {calculateMaxApy, fromWei, toWei} from '../utils/calculate';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import FlatButton from './FlatButton';
import MigrateModal from './MigrateModal';
import InfoIcon from "./InfoIcon.vue";
import AddFromWalletModal from "./AddFromWalletModal.vue";
import erc20ABI from "../../test/abis/ERC20.json";
import WithdrawModal from "./WithdrawModal.vue";
import {ActionSection} from "../services/globalActionsDisableService";
import SwapModal from "./SwapModal.vue";
import TOKEN_ADDRESSES from "../../common/addresses/arbitrum/token_addresses.json";
import {BigNumber} from "ethers";
import ABI_YY_WOMBAT_STRATEGY from "../abis/YYWombatStrategy.json";
import ConfirmModal from "./ConfirmModal.vue";

const ethers = require('ethers');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'StakingProtocolTableRowWombatYY',
  components: {InfoIcon, FlatButton, IconButtonMenuBeta},
  props: {
    farm: {
      required: true,
    },
    totalStaked: {
      required: true,
    }
  },
  async mounted() {
    this.chain = window.chain;
    this.createContractObject();
    this.setupAddActionsConfiguration();
    this.setupRemoveActionsConfiguration();
    this.watchHardRefreshScheduledEvent();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHealth();
    this.watchProgressBarState();
    this.watchFarmRefreshEvent();
    this.watchExternalStakedPerFarm();
    this.watchActionDisabling();
    this.watchSPrime();
    if (window.chain === 'arbitrum') {
      this.watchLtipMaxBoostUpdate();
    }
    if (window.chain === 'avalanche') {
      this.watchGgpIncentives();
    }
  },
  data() {
    return {
      chain: null,
      contract: null,
      hasEarlyAccess: null,
      receiptTokenBalance: 0,
      underlyingTokenStaked: 0,
      maxApy: 0,
      boostApy: 0,
      rewards: 0,
      isStakedBalanceEstimated: false,
      disableAllButtons: false,
      lpBalances: {},
      addActionsConfig: null,
      removeActionsConfig: null,
      healthLoaded: false,
      platypusAffected: false,
      platypusAffectedDisableDeposit: false,
      isActionDisabledRecord: {},
      collectedGGP: null,
      ggpCollectedTooltip: ''
    }
  },
  watch: {
    smartLoanContract: {
      async handler(smartLoanContract) {
        if (smartLoanContract) {
          this.$emit('stakedChange', this.underlyingTokenStaked);
        }
      },
      immediate: true
    },
    pools: {
      handler(pools) {
        this.maxApy = calculateMaxApy(this.pools, (this.apys[this.farm.lpAssetToken][this.farm.apyKey] + (this.farm.apyToAdd ? this.assets[this.farm.apyToAdd].apy : 0)) / 100);
      }
    }
  },
  computed: {
    ...mapState('network', ['account', 'provider']),
    ...mapState('poolStore', ['pools']),
    ...mapState('stakeStore', ['farms']),
    ...mapState('fundsStore', [
      'apys',
      'smartLoanContract',
      'fullLoanStatus',
      'debtsPerAsset',
      'assets',
      'assetBalances',
      'lpAssets',
      'concentratedLpAssets',
      'concentratedLpBalances',
      'traderJoeV2LpAssets',
      'levelLpAssets',
      'levelLpBalances',
      'penpieLpBalances',
      'penpieLpAssets',
      'wombatLpAssets',
      'wombatLpBalances',
      'wombatYYFarmsBalances',
      'noSmartLoan'
    ]),
    ...mapState('serviceRegistry', [
      'assetBalancesExternalUpdateService',
      'stakedExternalUpdateService',
      'dataRefreshEventService',
      'progressBarService',
      'farmService',
      'healthService',
      'deprecatedAssetsService',
      'ltipService',
      'globalActionsDisableService',
      'providerService',
      'sPrimeService',
      'ggpIncentivesService',
    ]),
    protocol() {
      return config.PROTOCOLS_CONFIG[this.farm.protocol];
    },
    disabled() {
      return !this.smartLoanContract || this.smartLoanContract.address === NULL_ADDRESS || this.disableAllButtons;
    },
    isLP() {
      return this.asset.secondary != null;
    },
    ggpConfig() {
      return config.ASSETS_CONFIG['GGP'];
    },
  },
  methods: {
    ...mapActions('stakeStore', ['migrateWombatToYY', 'depositToWombatYY', 'withdrawFromWombatYY']),

    async createContractObject() {
      this.contract = await new ethers.Contract(this.farm.strategyContract, ABI_YY_WOMBAT_STRATEGY, provider.getSigner());
    },

    watchSPrime() {
      if (this.farm.minSPrimeToUnlock) {
        this.sPrimeService.observeSPrimeValue().subscribe(value => {
          this.hasEarlyAccess = value >= this.farm.minSPrimeToUnlock;
        })
      } else {
        this.hasEarlyAccess = true;
      }
    },

    actionClick(key) {
      console.log(key);
      console.log(this.isActionDisabledRecord[key]);
      if (!this.isActionDisabledRecord[key]) {
        switch (key) {
          case 'DEPOSIT':
            this.openDepositModal();
            break;
          case 'DOPOSIT_AND_STAKE':
            this.openDepositLpModal();
            break;
          case 'MIGRATE':
            this.openMigrateModal();
            break;
          case 'WITHDRAW':
            this.openWithdrawModal();
            break;
          case 'UNSTAKE_AND_WITHDRAW':
            this.openUnstakeAndWithdrawModal();
            break;
        }
      }
    },

    protocolLogo(protocol) {
      return config.PROTOCOLS_CONFIG[protocol].logo;
    },

    async getWalletAssetBalance(symbol, address, decimals) {
      const tokenContract = new ethers.Contract(address, erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, symbol, tokenContract, decimals);
    },

    async openDepositModal() {
      if (this.disabled) {
        return;
      }
      let initSourceAsset = this.farm.assetToken;

      const modalInstance = this.openModal(StakeModal);
      modalInstance.apy = this.farm.apy / 100;
      modalInstance.available = this.assetBalances[initSourceAsset];
      modalInstance.underlyingTokenStaked = this.totalStaked;
      modalInstance.rewards = [];
      modalInstance.asset = config.ASSETS_CONFIG[initSourceAsset];
      modalInstance.isLP = this.false;
      modalInstance.$on('STAKE', async (stakeValue) => {
        console.log('stakeValue', stakeValue);
        const minOutResponse = await this.contract.getSharesForDepositTokens(toWei(stakeValue))
        const minOut = BigNumber.from(minOutResponse);

        const depositRequest = {
          yyToken: this.farm.yyToken,
          sourceAsset: this.farm.sourceAsset,
          amount: Number(stakeValue),
          minLpOut: fromWei(minOut),
          depositMethod: this.farm.depositMethod,
          decimals: this.farm.decimals,
        };

        this.handleTransaction(this.depositToWombatYY, {depositRequest: depositRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    async openDepositLpModal() {
      if (this.disabled) {
        return;
      }
      let initSourceAsset = this.farm.lpAssetToken;
      const walletLpBalance = await this.getWalletAssetBalance(initSourceAsset, this.farm.lpAssetTokenAddress, this.farm.decimals);
      console.log(walletLpBalance);
      const modalInstance = this.openModal(StakeModal);
      modalInstance.apy = this.farm.apy / 100;
      modalInstance.available = walletLpBalance;
      modalInstance.underlyingTokenStaked = this.totalStaked;
      modalInstance.rewards = [];
      modalInstance.assetLogo = this.farm.lpTokenLogo;
      modalInstance.forceAssetName = this.farm.name;
      modalInstance.asset = this.wombatLpAssets[initSourceAsset];
      modalInstance.isLP = this.false;
      modalInstance.$on('STAKE', async (stakeValue) => {
        const depositRequest = {
          yyToken: this.farm.yyToken,
          sourceAsset: initSourceAsset,
          amount: Number(stakeValue),
          depositMethod: this.farm.depositLpMethod,
          decimals: this.farm.decimals,
          requireApproval: true,
        };

        this.handleTransaction(this.depositToWombatYY, {depositRequest: depositRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    openWithdrawModal() {
      if (this.disabled) {
        return;
      }

      const maxToUnstake = this.wombatYYFarmsBalances[this.farm.yrtKey]
      const modalInstance = this.openModal(UnstakeModal);
      modalInstance.apy = this.farm.apy / 100;
      modalInstance.staked = maxToUnstake;
      modalInstance.title = 'Unstake to underlying asset';
      modalInstance.asset = {
        symbol: this.farm.symbol,
        price: this.wombatYYFarmsBalances[this.farm.apyKey] * this.wombatLpAssets[this.farm.lpAssetToken].price / this.wombatYYFarmsBalances[this.farm.yrtKey]
      };
      modalInstance.assetLogo = this.farm.YRTTokenLogo;
      modalInstance.targetAssetsOptions = [
        this.farm.assetToken
      ];
      modalInstance.justInput = true
      modalInstance.selectedTargetAsset = this.farm.assetToken;
      modalInstance.forceAssetName = this.farm.YRTName;
      modalInstance.receiptTokenBalance = maxToUnstake;
      modalInstance.isLP = false;
      modalInstance.$on('UNSTAKE', async unstakeEvent => {
        const minOutResponse = await this.contract.getDepositTokensForShares(toWei(unstakeEvent.receiptTokenUnstaked.toString()))
        const minOut = BigNumber.from(minOutResponse);

        const withdrawRequest = {
          amount: unstakeEvent.receiptTokenUnstaked,
          minOut: fromWei(minOut),
          decimals: this.farm.decimals,
          withdrawMethod: unstakeEvent.selectedTargetAsset === this.farm.assetToken ? this.farm.withdrawMethod : this.farm.withdrawInOtherTokenMethod,
        }

        this.handleTransaction(this.withdrawFromWombatYY, {withdrawRequest: withdrawRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
      });
    },

    openUnstakeAndWithdrawModal() {
      const modalInstance = this.openModal(WithdrawModal);
      modalInstance.asset = {
        ...this.wombatLpAssets[this.farm.lpAssetToken],
        short: this.farm.name,
        apyKey: this.farm.apyKey,
      };
      modalInstance.assetBalance = this.totalStaked;
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
      modalInstance.logo = this.farm.lpTokenLogo;
      modalInstance.showTopDescription = true;

      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const value = Number(withdrawEvent.value).toFixed(config.DECIMALS_PRECISION);
        const withdrawRequest = {
          amount: value,
          decimals: this.farm.decimals,
          withdrawMethod: this.farm.unstakeAndWithdrawMethod,
        }
        this.handleTransaction(this.withdrawFromWombatYY, {withdrawRequest: withdrawRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
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

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe((refreshEvent) => {
        this.disableAllButtons = false;
        this.$forceUpdate();
      });
    },

    watchFarmRefreshEvent() {
      this.farmService.observeRefreshFarm().subscribe(async () => {
        // receipt token staked
        this.balance = this.farm.totalBalance;
        // normal token staked
        this.underlyingTokenStaked = this.farm.totalStaked;
        this.setApy();
        if (this.farm.totalStaked > 0 && this.farm.droppingSupport) {
          console.warn('has deprecated farms');
          this.deprecatedAssetsService.emitHasDeprecatedAssets();
        }
      });
    },

    watchExternalStakedPerFarm() {
      this.stakedExternalUpdateService.observeExternalStakedBalancesPerFarmUpdate().subscribe(stakedBalancesPerFarmUpdate => {
        if (this.farm.protocolIdentifier === stakedBalancesPerFarmUpdate.protocolIdentifier) {
          this.receiptTokenBalance = stakedBalancesPerFarmUpdate.receiptTokenBalance;
          this.farm.totalBalance = stakedBalancesPerFarmUpdate.receiptTokenBalance;
          this.underlyingTokenStaked = stakedBalancesPerFarmUpdate.stakedBalance;
          this.farm.totalStaked = stakedBalancesPerFarmUpdate.stakedBalance;
        }
        this.$forceUpdate();
      });
    },

    setApy() {
      if (this.pools) {
        this.maxApy = calculateMaxApy(this.pools, (this.apys[this.farm.lpAssetToken][this.farm.apyKey] + (this.farm.apyToAdd ? this.assets[this.farm.apyToAdd].apy : 0)) / 100);
      }
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
            this.isStakedBalanceEstimated = false;
            this.disableAllButtons = false;
            break;
          }
          case 'CANCELLED' : {
            this.isStakedBalanceEstimated = false;
            this.disableAllButtons = false;
            break;
          }
        }
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
      this.isStakedBalanceEstimated = false;
    },
    setupAddActionsConfiguration() {
      this.addActionsConfig = {
        iconSrc: 'src/assets/icons/plus.svg',
        tooltip: 'Add',
        disabled: this.farm.inactive,
        menuOptions: [
          {
            key: 'DEPOSIT',
            name: `Deposit ${this.farm.assetToken} to Wombat LP farm`,
            disabled: this.isActionDisabledRecord['DEPOSIT']
          },
          {
            key: 'MIGRATE',
            name: 'Farm Wombat LP',
            disabled: this.isActionDisabledRecord['MIGRATE']
          },
          {
            key: 'DOPOSIT_AND_STAKE',
            name: 'Deposit Wombat LP from wallet and farm',
            disabled: this.isActionDisabledRecord['DOPOSIT_AND_STAKE']
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
            key: 'WITHDRAW',
            name: `Unstake to ${this.farm.assetToken}`,
            disabled: this.isActionDisabledRecord['WITHDRAW'] || this.farm.inactive
          },
          {
            key: 'UNSTAKE_AND_WITHDRAW',
            name: 'Withdraw Wombat LP to wallet',
            // disabled: this.isActionDisabledRecord['UNSTAKE_AND_WITHDRAW'] || this.farm.inactive
            disabled: true
          },
        ]
      }
    },

    watchGgpIncentives() {
      this.ggpIncentivesService.collectedGGPYieldYak$.subscribe(collected => {
        this.collectedGGP = collected;
        setTimeout(() => {
          this.$forceUpdate();
        });
      });
      this.ggpIncentivesService.boostGGPYieldYakApy$.subscribe(boost => {
        const ggpPrice = this.assets['GGP'] ? this.assets['GGP'].price : 0;
        this.boostApy = boost ? boost.boostApy * ggpPrice : 0;
        setTimeout(() => {
          this.$forceUpdate();
        });
      });
    },

    openMigrateModal() {
      const modalInstance = this.openModal(ConfirmModal);
      modalInstance.title = 'Migrate to Yield Yak';
      modalInstance.content = this.wombatLpBalances[this.farm.lpAssetToken] > 0 ? `This action will farm all your Wombat ${this.farm.assetToken} LP tokens in Yield Yak`
          : `Currently you have no ${this.farm.name} tokens in your Prime Account. <br> To create a new position, use the <b>Deposit ${this.farm.assetToken} to Wombat LP Farm</b> action.`;
      modalInstance.disabled = this.wombatLpBalances[this.farm.lpAssetToken] <= 0

      const migrateRequest = {
        migrateMethod: this.farm.migrateMethod,
      };
      modalInstance.$on('CONFIRM', () => {
        this.handleTransaction(this.migrateWombatToYY, {migrateRequest: migrateRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        });
      });
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.STAKING_PROTOCOL_WOMBAT)
          .subscribe(isActionDisabledRecord => {
            this.isActionDisabledRecord = false;
            this.setupAddActionsConfiguration();
            this.setupRemoveActionsConfiguration();
          })
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.staking-farm-table-row-component {

  &:not(:first-child) {
    border-style: solid;
    border-width: 2px 0 0 0;
    border-image-source: var(--staking-protocol-table-row__border);
    border-image-slice: 1;
  }

  .protocol-banner {
    color: $orange;
    font-weight: 500;
    font-size: $font-size-xxs;
    margin-top: 5px;
    margin-bottom: -10px;

    .banner__link {
      color: $orange;
      font-weight: 600;
    }
  }

  .table__row {
    display: grid;
    grid-template-columns: 23% 1fr 170px 170px 160px 190px 22px;
    height: 60px;
    padding: 0 6px;

    .table__cell {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      font-weight: 500;
      font-size: $font-size-xsm;

      &.farm-cell {
        justify-content: flex-start;
      }

      &.rewards__cell {

        .rewards__wrapper {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;

          .info__icon {
            margin-left: 5px;
          }
        }
      }

      .farm {
        display: flex;
        flex-direction: row;
        align-items: center;

        .protocol__icon {
          opacity: var(--staking-protocol-table-row__protocol-icon-opacity);
          height: 22px;
          width: 22px;
          border-radius: 50%;
        }

        .protocol__details {
          display: flex;
          flex-direction: column;
          margin-left: 10px;

          .asset__name {
            font-size: $font-size-xsm;
            font-weight: 500;
          }

          .info__icon {
            transform: translateY(-2px);
          }

          .by-farm {
            font-size: $font-size-xxs;
            font-weight: 500;
            color: var(--staking-protocol-table-row__secondary-text-color);
            margin-top: -2px;
          }
        }
      }

      .double-value {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        text-align: end;

        .double-value__pieces {
          font-weight: 500;
          font-size: $font-size-xsm;
        }

        &.balance-balance {
          .double-value__pieces {
            font-weight: 600;
          }
        }

        .double-value__usd {
          font-size: $font-size-xxs;
          color: var(--staking-protocol-table-row__secondary-text-color);
        }
      }

      &.ggp-collected {
        .asset__icon {
          width: 20px;
          height: 20px;
          opacity: var(--asset-table-row__icon-opacity);
        }
      }

      &.max-apy {
        font-weight: 600;

        .stars-icon {
          width: 20px;
          margin-right: 10px;
          transform: translateY(-2px);
        }
      }

      &.apy {
        .apr-warning {
          margin-right: 5px;
        }
      }

      .reward__icons {
        .reward__asset__icon {
          margin-right: 5px;
          width: 20px;
          height: 20px;
        }
      }

      .actions {
        display: flex;
        flex-direction: row;
        align-items: center;

        .actions__icon-button {
          width: 26px;
          height: 26px;
          cursor: pointer;

          &:not(:last-child) {
            margin-right: 12px;
          }

          &.disabled {
            opacity: 0.5;
            cursor: default;
          }
        }
      }
    }
  }
}
</style>
<style lang="scss">
.tooltip {
  max-width: none;
  width: auto;
}
</style>
