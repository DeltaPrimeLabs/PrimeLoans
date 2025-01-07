<template>
  <div class="pools-table-row-component">
    <div class="table__row" v-if="pool" :class="{'arbitrum': isArbitrum, 'disabled': pool.disabled}">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(pool.asset.symbol)">
        <div class="asset__info">
          <div class="asset__name">{{ pool.asset.symbol }}</div>
        </div>
      </div>
      <div class="table__cell table__cell--double-value deposit">
        <template>
          <div class="double-value__pieces">
            <LoadedValue :check="() => pool.deposit != null"
                         :value="pool.deposit | smartRound(5, false) | formatWithSpaces"></LoadedValue>
          </div>
          <div class="double-value__usd">
            <span v-if="pool.deposit">{{ pool.deposit * pool.assetPrice | usd }}</span>
          </div>
        </template>
        <template v-if="pool.deposit === 0">
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell sprime">
        <div>
          <LoadedValue :check="() => pool.sPrime !== null" :value="pool.sPrime | usd"></LoadedValue>
        </div>
      </div>

      <div class="table__cell table__cell--double-value apy">
        <template>
          <div class="double-value__pieces">
            <LoadedValue :check="() => pool.apy != null" :value="formatPercent(pool.apy + pool.miningApy)">
            </LoadedValue>
          </div>
          <div class="double-value__usd">
            <span
              v-if="pool.apy != null && pool.miningApy">{{ formatPercent(pool.apy) }}&nbsp;+&nbsp;{{
                formatPercent(pool.miningApy)
              }}</span>
          </div>
        </template>
      </div>

      <div class="table__cell table__cell--double-value tvl">
        <div class="double-value__pieces">
          <LoadedValue :check="() => pool.tvl != null"
                       :value="pool.tvl | smartRound(5, false) | formatWithSpaces"></LoadedValue>
        </div>
        <div class="double-value__usd">
          <span v-if="pool.tvl">{{ pool.tvl * pool.assetPrice | usd }}</span>
        </div>
      </div>

      <div class="table__cell unlocked" v-if="isArbitrum">
        <bar-gauge-beta :min="0" :max="1" :width="80"
                        :value="Math.min(pool.tvl * pool.assetPrice / 1000000, 1)"></bar-gauge-beta>
      </div>

      <div class="table__cell utilisation">
        <LoadedValue :check="() => pool.utilisation != null" :value="pool.utilisation | percent"></LoadedValue>
      </div>

      <div></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-for="(actionConfig, index) of actionsConfig"
          :disabled="!pool.contract || pool.disabled"
          v-bind:key="index"
          :config="actionConfig"
          v-on:iconButtonClick="actionClick">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-if="moreActionsConfig"
          :config="moreActionsConfig"
          v-on:iconButtonClick="actionClick"
          :disabled="!pool">
        </IconButtonMenuBeta>
      </div>
    </div>

  </div>
</template>

<script>
import LoadedValue from './LoadedValue';
import IconButtonMenuBeta from './IconButtonMenuBeta';
import DepositModal from './DepositModal';
import {mapActions, mapState} from 'vuex';
import PoolWithdrawModal from './PoolWithdrawModal';
import BridgeDepositModal from './BridgeDepositModal';

const ethers = require('ethers');
import SimpleSwapModal from './SimpleSwapModal.vue';
import config from '../config';
import YAK_ROUTER_ABI from '../../test/abis/YakRouter.json';
import BarGaugeBeta from './BarGaugeBeta.vue';
import InfoIcon from './InfoIcon.vue';
import {ActionSection} from '../services/globalActionsDisableService';
import ClaimRewardsModal from './ClaimRewardsModal.vue';
import DoubleClaimRewardsModal from './DoubleClaimRewardsModal.vue';
import AddToWithdrawQueueModal from './AddToWithdrawQueueModal.vue';
import QueueStatus from './AddToWithdrawQueueModal.vue';

let TOKEN_ADDRESSES;

export default {
  name: 'PoolsTableRowBeta',
  components: {InfoIcon, BarGaugeBeta, LoadedValue, IconButtonMenuBeta},
  props: {
    pool: {},
  },

  async mounted() {
    this.isArbitrum = config.chainSlug === 'arbitrum';
    this.isAvalanche = config.chainSlug === 'avalanche';
    await this.setupFiles();
    this.setupActionsConfiguration();
    this.setupWalletAssetBalances();
    this.setupPoolsAssetsData();
    this.watchLifi();
    this.watchActionDisabling();
    this.watchWithdrawalIntents();
    setTimeout(() => {
      console.log(this.isActionDisabledRecord);
    }, 4000)
  },

  data() {
    return {
      actionsConfig: null,
      moreActionsConfig: null,
      walletAssetBalances: {},
      poolDepositBalances: {},
      poolAssetsPrices: {},
      poolContracts: {},
      lifiData: {},
      miningApy: 0,
      isArbitrum: null,
      isAvalanche: null,
      isActionDisabledRecord: {},
      intents: null,
    };
  },

  computed: {
    ...mapState('network', ['account', 'accountBalance', 'provider']),
    ...mapState('fundsStore', [
      'assetBalances',
      'fullLoanStatus',
      'debtsPerAsset',
      'assets',
      'lpAssets',
      'lpBalances',
      'noSmartLoan'
    ]),
    ...mapState('serviceRegistry', [
      'poolService',
      'ltipService',
      'walletAssetBalancesService',
      'lifiService',
      'progressBarService',
      'providerService',
      'globalActionsDisableService',
      'poolWithdrawQueueService'
    ]),
  },

  methods: {
    ...mapActions('poolStore', ['deposit', 'withdraw', 'swapDeposit', 'claimAvalancheBoost']),

    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    setupActionsConfiguration() {
      console.warn('WITHDRAW', this.isActionDisabledRecord['WITHDRAW']);
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          tooltip: 'Deposit / Bridge',
          menuOptions: [
            {
              key: 'DEPOSIT',
              name: 'Deposit',
              disabled: this.isActionDisabledRecord['DEPOSIT'],
            },
            ...(this.pool.asset.symbol === 'AVAX' ? [{
              key: 'BRIDGE',
              name: 'Bridge',
              disabled: this.isActionDisabledRecord['BRIDGE'] || this.isArbitrum,
            }] : []),
            {
              key: 'BRIDGE_DEPOSIT',
              name: 'Bridge and deposit',
              disabled: this.isActionDisabledRecord['BRIDGE_DEPOSIT'] || this.isArbitrum,
              disabledInfo: 'Available soon'
            },
          ]
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          tooltip: 'Withdraw',
          iconButtonActionKey: 'WITHDRAW',
          disabled: this.isActionDisabledRecord['WITHDRAW'],
        }
      ];
    },

    setupMoreActionsConfiguration() {
      const poolsWithClaim = ['AVAX', 'USDC', 'USDT', 'BTC'];
      this.moreActionsConfig = {
        iconSrc: 'src/assets/icons/icon_a_more.svg',
        tooltip: 'More',
        menuOptions: [
          {
            iconSrc: 'src/assets/icons/swap.svg',
            key: 'WITHDRAW',
            name: 'Swap',
            disabled: this.isActionDisabledRecord['SWAP_DEPOSIT'],
          }
          ,
          poolsWithClaim.includes(this.pool.asset.symbol) ? {
            key: 'CLAIM_AVALANCHE_BOOST',
            name: 'Claim rewards',
            disabled: this.isActionDisabledRecord['CLAIM_AVALANCHE_BOOST'],
          } : null,
        ]
      };
    },

    setupWalletAssetBalances() {
      this.walletAssetBalancesService.observeWalletAssetBalances().subscribe(balances => {
        this.walletAssetBalances = balances;
      });
    },

    setupPoolsAssetsData() {
      const poolDepositBalances = {};
      const poolAssetsPrices = {};
      const poolContracts = {};
      this.poolService.observePools().subscribe(pools => {
        console.log('PoolsTableRow', pools);
        pools.forEach(pool => {
          poolDepositBalances[pool.asset.symbol] = pool.deposit;
          poolAssetsPrices[pool.asset.symbol] = pool.assetPrice;
          poolContracts[pool.asset.symbol] = pool.contract;
        })
        this.poolDepositBalances = poolDepositBalances;
        this.poolAssetsPrices = poolAssetsPrices;
        this.poolContracts = poolContracts;
        this.$forceUpdate();
      })
    },

    watchLifi() {
      this.lifiService.observeLifi().subscribe(async lifiData => {
        this.lifiData = lifiData;
      });
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.POOLS)
        .subscribe(isActionDisabledRecord => {
          this.isActionDisabledRecord = isActionDisabledRecord;
          this.setupActionsConfiguration();
          this.setupMoreActionsConfiguration();
        })
    },

    watchWithdrawalIntents() {
      this.poolWithdrawQueueService.observePoolIntents().subscribe(intents => {
        this.intents = intents[this.pool.asset.symbol];
      })
    },

    actionClick(key) {
      if (!this.isActionDisabledRecord[key]) {
        const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
        const activeTransfer = history ? history[this.account.toLowerCase()] : null;

        switch (key) {
          case 'DEPOSIT':
            this.openDepositModal();
            break;
          case 'BRIDGE':
            if (activeTransfer) {
              this.$emit('openResumeBridge', activeTransfer);
            } else {
              this.openBridgeModal(true);
            }
            break;
          case 'BRIDGE_DEPOSIT':
            if (activeTransfer) {
              this.$emit('openResumeBridge', activeTransfer);
            } else {
              this.openBridgeModal(false);
            }
            break;
          case 'WITHDRAW':
            this.openWithdrawModal();
            break;
          case 'SWAP_DEPOSIT':
            this.openSwapDepositModal();
            break;
          case 'CLAIM_AVALANCHE_BOOST':
            this.openClaimAvalancheBoost();
            break;
        }
      }
    },

    async openDepositModal() {
      const modalInstance = this.openModal(DepositModal);
      modalInstance.pool = this.pool;
      modalInstance.apy = this.pool.apy;
      modalInstance.walletAssetBalance = this.walletAssetBalances[this.pool.asset.symbol];
      modalInstance.accountBalance = this.accountBalance;
      modalInstance.deposit = this.pool.deposit;
      modalInstance.assetSymbol = this.pool.asset.symbol;
      modalInstance.miningApy = this.pool.miningApy;
      modalInstance.rewardToken = this.pool.avalancheBoostRewardToken;

      console.log('pool: ', this.pool)
      console.log('this.pool.miningApy: ', this.pool.miningApy)
      console.log('modalInstance.miningApy: ', modalInstance.miningApy)
      console.log('modalInstance.rewardToken: ', modalInstance.rewardToken)

      modalInstance.$on('DEPOSIT', depositEvent => {
        const depositRequest = {
          assetSymbol: this.pool.asset.symbol,
          amount: depositEvent.value,
          depositNativeToken: depositEvent.depositNativeToken
        };

        this.handleTransaction(this.deposit, {depositRequest: depositRequest}, () => {
          this.pool.deposit = Number(this.pool.deposit) + depositRequest.amount;
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error, true);
        }).finally(() => {
          this.closeModal();
        });
      });
    },

    openBridgeModal(disableDeposit = false) {
      const modalInstance = this.openModal(BridgeDepositModal);
      modalInstance.account = this.account;
      modalInstance.lifiData = this.lifiData;
      modalInstance.lifiService = this.lifiService;
      modalInstance.targetAsset = this.pool.asset.symbol;
      modalInstance.targetAssetAddress = this.pool.asset.address;
      modalInstance.targetBalance = this.poolDepositBalances[this.pool.asset.symbol];
      modalInstance.disableDeposit = disableDeposit;
      modalInstance.$on('BRIDGE_DEPOSIT', bridgeEvent => {
        const bridgeRequest = {
          lifi: this.lifiData.lifi,
          ...bridgeEvent,
          signer: this.provider.getSigner(),
          depositFunc: this.deposit,
          targetSymbol: this.pool.asset.symbol,
          disableDeposit
        };

        this.handleTransaction(this.lifiService.bridgeAndDeposit, {
          bridgeRequest: bridgeRequest,
          progressBarService: this.progressBarService,
          resume: false
        }, (res) => {
          if (!res) return;
          this.pool.deposit = Number(this.pool.deposit) + Number(res.amount);
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
          this.closeModal();
        });
      });
    },

    openWithdrawModal() {
      const modalInstance = this.openModal(AddToWithdrawQueueModal);
      let queue = [];
      let extraIntents = 0
      if (this.intents && this.intents.length > 0) {
        queue = this.intents.slice(0, 2).map(intent => ({
          amount: intent.amount,
          symbol: this.pool.asset.symbol,
          status: intent.isPending ? 'PENDING' : 'READY',
          date: intent.isPending ? intent.actionableAt : intent.expiresAt
        }));
        extraIntents = this.intents.length - queue.length;
      }
      modalInstance.assetBalance = this.pool.deposit;
      modalInstance.asset = this.pool.asset;
      modalInstance.queue = queue;
      modalInstance.extraIntents = extraIntents;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        console.log(withdrawEvent);
        this.poolWithdrawQueueService.createWithdrawalIntent(this.pool.asset.symbol, withdrawEvent.value)

      });
    },

    openSwapDepositModal() {
      const depositAssets = Object.entries(config.POOLS_CONFIG).filter(([symbol, data]) => !data.disabled).map(entry => entry[0]);
      const modalInstance = this.openModal(SimpleSwapModal);
      modalInstance.sourceAsset = this.pool.asset.symbol;
      modalInstance.sourceAssetBalance = this.pool.deposit;
      modalInstance.sourceAssets = depositAssets;
      modalInstance.targetAssets = depositAssets;
      modalInstance.assetBalances = this.poolDepositBalances;
      modalInstance.assetPrices = this.poolAssetsPrices;
      modalInstance.targetAsset = depositAssets.filter(asset => asset !== this.pool.asset.symbol)[0];
      modalInstance.debt = this.fullLoanStatus.debt;
      modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue ? this.fullLoanStatus.thresholdWeightedValue : 0;
      modalInstance.health = this.fullLoanStatus.health;
      modalInstance.queryMethod = this.swapDepositQueryMethod();


      modalInstance.$on('SWAP', swapEvent => {
        const sourceAssetDecimals = config.ASSETS_CONFIG[swapEvent.sourceAsset].decimals;
        const targetAssetDecimals = config.ASSETS_CONFIG[swapEvent.targetAsset].decimals;
        const swapDepositRequest = {
          ...swapEvent,
          sourceAmount: swapEvent.sourceAmount.toFixed(sourceAssetDecimals),
          targetAmount: swapEvent.targetAmount.toFixed(targetAssetDecimals),
          sourcePoolContract: this.poolContracts[swapEvent.sourceAsset],
        };

        this.handleTransaction(this.swapDeposit, {swapDepositRequest: swapDepositRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        })
      })
    },

    swapDepositQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {
        const tknFrom = TOKEN_ADDRESSES[sourceAsset];
        const tknTo = TOKEN_ADDRESSES[targetAsset];

        const readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
        const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, readProvider);

        const maxHops = 3;
        const gasPrice = ethers.utils.parseUnits('0.2', 'gwei');

        try {
          return await yakRouter.findBestPathWithGas(
            amountIn,
            tknFrom,
            tknTo,
            maxHops,
            gasPrice,
            {gasLimit: 1e9}
          );
        } catch (e) {
          this.handleTransactionError(e);
        }
      };
    },

    async openClaimAvalancheBoost() {
      const modalInstance = this.openModal(DoubleClaimRewardsModal);
      let totalRewards = [];
      totalRewards.push({
        symbol: this.pool.avalancheBoostRewardToken,
        amount: this.pool.unclaimed,
        amountOld: this.pool.unclaimedOld,
      })

      modalInstance.tokensConfig = config.ASSETS_CONFIG;
      modalInstance.totalRewards = totalRewards;
      modalInstance.header = 'Claim Boost rewards'

      modalInstance.$on('CLAIM', () => {
        console.log('claim');
        const claimBoostRequest = {
          depositRewarderAddress: config.AVALANCHE_BOOST_CONFIG[this.pool.asset.symbol].depositRewarderAddress
        };

        this.handleTransaction(this.claimAvalancheBoost({claimBoostRequest: claimBoostRequest}), () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });

      modalInstance.$on('CLAIM_OLD', () => {
        console.log('claim old');
        const claimBoostRequest = {
          depositRewarderAddress: config.AVALANCHE_BOOST_CONFIG[this.pool.asset.symbol].depositRewarderOldAddress
        };

        this.handleTransaction(this.claimAvalancheBoost({claimBoostRequest: claimBoostRequest}), () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },

    handleTransactionError(error, isBridge = false) {
      if (error.code === 404) {
        this.progressBarService.emitProgressBarErrorState('Action is currently disabled')
      }
      if (error.code === 4001 || error.code === -32603) {
        this.progressBarService.emitProgressBarCancelledState();

        if (isBridge) {
          const history = JSON.parse(localStorage.getItem('active-bridge-deposit'));
          const userKey = this.account.toLowerCase();
          const updatedHistory = {
            ...history,
            [userKey]: {
              ...history[userKey],
              cancelled: true
            }
          };

          localStorage.setItem('active-bridge-deposit', JSON.stringify(updatedHistory));
        }
      } else {
        this.progressBarService.emitProgressBarErrorState();
      }
      this.closeModal();
      this.disableAllButtons = false;
      this.isBalanceEstimated = false;
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.pools-table-row-component {
  height: 60px;
  transition: all 200ms;

  .table__row {
    display: grid;
    grid-template-columns: 1fr repeat(5, 160px) 70px 110px 22px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: var(--asset-table-row__border);
    border-image-slice: 1;
    padding-left: 6px;

    &.disabled {
      .table__cell {
        opacity: 30%;
      }
    }

    &.arbitrum {
      grid-template-columns: repeat(3, 1fr) 140px 140px 140px 140px 90px 90px 22px;
    }

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

        .stars-icon {
          width: 20px;
          margin-right: 10px;
          transform: translateY(-2px);
        }
      }

      &.deposit {
        align-items: flex-end;
      }

      &.sprime {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
        font-weight: 600;
      }

      &.avalanche-boost {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
        font-weight: 600;

        .avalanche-boost-unclaimed {
          display: flex;
          flex-direction: row;

          .asset__icon {
            margin-left: 5px;
            width: 20px;
            height: 20px;
            opacity: var(--asset-table-row__icon-opacity);
          }
        }
      }

      &.apy {
        align-items: flex-end;
        justify-content: flex-end;
        font-weight: 600;
        color: var(--asset-table-row__apy-color);
      }

      &.interest {
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-left: 49px;
      }

      &.tvl {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
        font-weight: 500;
      }

      &.unlocked {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
      }

      &.utilisation {
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
        font-weight: 500;
      }

      &.actions {
        align-items: center;
        justify-content: flex-end;

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
.pools-table-row-component {
  .table__row {
    .bar-gauge-beta-component .bar-gauge .bar {
      width: 80px;
    }
  }
}
</style>
