<template>
  <div class="pools-table-row-component">
    <div class="table__row" v-if="pool" :class="{'arbitrum': isArbitrum, 'disabled': pool.disabled}">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(pool.asset.symbol)">
        <div class="asset__info">
          <div class="asset__name">{{ pool.asset.symbol }}</div>
        </div>
        <div v-if="pool.hasAvalancheBoost">
          <img
            v-tooltip="{content: `This pool is incentivized with Boost Program.`, classes: 'info-tooltip'}"
            src="src/assets/icons/stars.png" class="stars-icon">
        </div>
      </div>
      <div class="table__cell table__cell--double-value deposit">
        <template>
          <div class="double-value__pieces">
            <img src="src/assets/icons/warning.svg" v-if="isRecalculatedYY"
                 v-tooltip="{content: 'The balances from YieldYak pools are being updated. That should be finished soon.', classes: 'info-tooltip long'}">
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

      <div class="table__cell avalanche-boost" v-if="isAvalanche">
        <div class="avalanche-boost-unclaimed" v-if="pool.hasAvalancheBoost">
          <LoadedValue :check="() => pool.unclaimed !== null && pool.unclaimedOld !== null"
                       :value="(pool.hasAvalancheBoost ? Number(pool.unclaimed) + Number(pool.unclaimedOld) : 0) | smartRound(5, false)"></LoadedValue>
          <img class="asset__icon" v-if="pool.avalancheBoostRewardToken"
               :src="getAssetIcon(pool.avalancheBoostRewardToken)">
        </div>
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
          :disabled="!pool.contract || pool.disabled || isRecalculatedYY"
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
      isRecalculatedYY: false
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
      'withdrawQueueService'
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
          this.pool.hasAvalancheBoost ? {
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

        this.setIsRecalculatedYY();
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
      this.withdrawQueueService.observePoolIntents().subscribe(intents => {
        console.log('ROW_----------___--____-___--___---');
        console.log(intents);
        this.intents = intents[this.pool.asset.symbol];
        console.log(this.intents);
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
        const withdrawRequest = {
          assetSymbol: this.pool.asset.symbol,
          amount: withdrawEvent.value,
          withdrawNativeToken: withdrawEvent.withdrawNativeToken,
        };
        console.log(withdrawEvent);
        // this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
        //   this.pool.deposit = Number(this.pool.deposit) - withdrawRequest.amount;
        //   this.$forceUpdate();
        // }, (error) => {
        //   this.handleTransactionError(error);
        // }).then(() => {
        // });

        this.withdrawQueueService.createWithdrawalIntent(this.pool.asset.symbol, withdrawEvent.value)

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
    setIsRecalculatedYY() {
      let recalculatedYieldYak = [
        "0x80751eacad9431ec8b86b857777383dc07c5603d",
        "0xa80fa66f66e7eddfefa0a617b49f43dd713fd086",
        "0x09167154e444884b06d6608ce842ddc3a768b22a",
        "0xc7a53bbc9185a1d7878359003254c244ae83c60f",
        "0x14e895102acd7d639c76276094990dcfdd20102f",
        "0xbc78b6b4a4433fc9825738e131d75ed11d5cd128",
        "0x920209830dab542d3ee271439590d9664ea03bd2",
        "0x8f5126847d6743ccb98233e0883615fc9bec6545",
        "0xf32b445934ff05d9ec488485a6132fc8e309b42d",
        "0x54b2d9aef22d594b26e7f61bb51548066e137270",
        "0x3dcb67ab54ebd6e134c9219516a196705dc3ba59",
        "0x6f467cda73d34594498d21bd29cd2aa58b4fba20",
        "0x08e0d81f520452bde9b9503cbe86bce004d28cbd",
        "0x87f55e8b567a1169b5ce564b97744f3330b0c084",
        "0xee22b9596953b0705bb2dd6d598a07ef708d815d",
        "0x97c2ea4c75ee00a29baea35ccb63f8ce9f17890b",
        "0x38274862b7124d6476311b99693f7f1f80c86d31",
        "0x90a5824dfc2f7b9d7ab41343129feb4b8081db20",
        "0x55b675fc360714d6cee43a58eb05673339d7ba36",
        "0xded492e1110073b6a98418c136297d2eb60faa3d",
        "0xdfdfdb3711c7f902c1d099f9a8ecdcbaba4607dc",
        "0x08fe4f98d1447dd0429e68725a8406484db51646",
        "0x138d146ca9bb6db4f0756fce035bed5c4f2ed8f5",
        "0xc315799ba0411b74a38220d56432f7507c0ffa2f",
        "0xd23588799d5bc9f9d0f1b7e2a469877ef1957017",
        "0xe0527e66ed8c7e372007de0d65a5eb45cac53e07",
        "0x833ee32fb08c742e5a646e7fa5750db3ceaf158f",
        "0x44a4d3a6ed59e16d89bc79637d94be9d113416e8",
        "0xd9f4da967fab291e475795c877504450c26de279",
        "0xa877502facc63f9f0585e523e82db5cf9b38cdfa",
        "0x78cc023162c3d105b833cd9b97048c3385c829a6",
        "0xb320b06da220878bf0f7b66acd0d399b8a8985ca",
        "0xd1c5c8725446022951dadbd40ac847ec78cf5b13",
        "0xb4aeefb9b7eba97d34791c1822c25d2d55f936eb",
        "0x3c19b8a4847eff3c8fb155d3888a2d2df733a38b",
        "0xdb841598995c773a90a7166ff6e2782bc96d41ad",
        "0xfcb6df91c6128f0d0947d46c64005facf4ade5f9",
        "0xdc018de548448ecddae3467d8cdb3af150783e0b",
        "0x700be855745f7f3f017473ed03e8a9af28e08acb",
        "0x132754c163ff27138d0f2a12ba8678f58f4a3326",
        "0x49fc0865b77c9ba21781e6a961c2f7a6474b9e47",
        "0x8d8bda55ed78035947597cb64f6aca72739f0580",
        "0xc0835ce87dbd79e6c38c1c672155e7a4f0216ce4",
        "0x71b9e20a2ddb80eb3b2f7a800cb7b039948283df",
        "0xecab99d718d199f652d6c98a80adeece5eef644c",
        "0x60360c35bb3ae091c45479d52e84fc7209cb8f11",
        "0xedce05d6c882c39ddbebe7c33286c5d2a2876b66",
        "0x3aa0c2753a3d5c36d233867b5f7f4f471c0e256a",
        "0xee38fecc24fc56813be8a5c073612451a460cb7e",
        "0x1de519a0d3a2bfccca5a8c58c91b215b3723deef",
        "0x25a11813331854e8315c0754371cda8131b19088",
        "0x0aaf0d1eaa181131b9cd4cd9b8b9440e2cd57bb2",
        "0xe53e02040237ab4c521e93636a66c757c6062aab",
        "0xc3fafc13f7b58fc205e7962b5f67fba2c678c33d",
        "0x91e2441f989efba45f8c42fbaccc43b8e65d71d5",
        "0x9da1a931a572776c98dc87e7d9aa78784f875866",
        "0xae92b2aa078de01ede8cba8760023ff210eea511",
        "0x075e767cfe343ebf8d3f63390dc38d8584eb9832",
        "0x2c9b17c98fab09b412f7edab37624f346b7de35e",
        "0xde5848daecc77d00c056dd06393a2497aa2caec2",
        "0x7f4e5705f8e436d4b685ffbffbfe6b385096cb4c",
        "0xa38e5bbceb22aca04f11d3a3d7e4180ecfdebcd7",
        "0x6676055ab3f5b91092278ebf4f1e57c842b41d81",
        "0x198a8aac7a22cccfb8b8411cc7e594ad58625d33",
        "0xa46a81c50d9ba0fc2c85d26aefd05a88c4e0ec07",
        "0x8c31e4fd0350a4e2920123a81b38ae58292b176a",
        "0xcb8b0567993258e02a17dc9895fce424fb1740fe",
        "0xa72c59ebccf224f5af8c59682536704305992246",
        "0xddc19b309f65bd7263a873a29c8ea8651b7de2bc",
        "0xd2080492c161628c962749f1c41ff6dc211feefa",
        "0x276ec22119aedc41eb91752aa463dff68076d482",
        "0xbe83d4da84fb19978fde9b31f688cbc2b02be54f",
        "0x7946bfbf6c23f1ff0e59f058f04fbf5e2198416a",
        "0x8a757ab0de17d3d820a6e2c8516acc239b4b4bfe",
        "0x4d95c57f61f0eda120ec7f973cd8c5daef40c51a",
        "0xd58ccafc31ce8e2e503f5dfc32ff54172bde7e78",
        "0x08b776a6907303558433be9b9583f21d41a58dfd",
        "0x0a26e3ac3b672418241c395fdc108454772726f6",
        "0x78931575e4b68204d916002afbe998ff6b45aa52",
        "0x54a92a5d09f87554314812568a2bc40a9e931bfa",
        "0x7909acc2c9fba6cf01cba70e5f00e6b47ca68b55",
        "0x38199397111feb1461e5c1c35d36a2b1358d6437",
        "0xa2d38427536e0bb2bfc07223cbb6b3350987a885",
        "0xce27e7f85132c133dc39bb54bcb7ea7a3ae1b424",
        "0xf724a3bd87cd41b032655f8d68d3b36face87977",
        "0xee10223db5269ca0eefe488e7c47e25f7460b381",
        "0xec0a7af6ec90688d299bed762c4db20fad9897cf",
        "0x004889f848135b9ce985386de01fe0c17ff32a4e",
        "0x91d659a359348d4a17a726e822a17d7b01499d86",
        "0xeeb42b37afd1a92fa5e8e99fb335b93b445fde95",
        "0xbca921c66232319ff912f1e2159ed9d5ed3a4aae",
        "0x66db467a76adc2d162b0508a198edbe3f7271109",
        "0x91d19f8806d118a3554d94041e382f1b18559863",
        "0xad4c9c0d821e9be46161c89d332af690f7abcad2",
        "0xb3be1649cce25c2e72c56492efe4c515008a6e2c",
        "0x8df5787aafaee95b4f6b8d66a94538d0b3731c52",
        "0x9934c66eebc492708964fa8c3ef25d181257ff41",
        "0xd5df955c8ee1a98a443172d7f5d3edd62ed11ad0",
        "0x3a0971f352312303ceed056b12d542b30cfe9796",
        "0x7fd57cfeb265841044585f57c11df7a948fb2997",
        "0x59b81377db42314c8842fd033e813fa6820f3db9",
        "0xa70d7f7b7ff356e904b5f7afe2f41e8f9005434e",
        "0xe2924d22815d746a89df88477d21efd2df8f2af9",
        "0xcce1867ec3efc961c1e981feb54524761ecc72d4",
        "0x716547f28fc3a2effa9913c7e3894fdb5566f277",
        "0xf7054b5cbb79f5f40c7610d94ecf26fbb5f8a696",
        "0xbc713613b03c3d71e68cf83b98a4bcec3f127ce2",
        "0xfb076dc52e7b750fb7779811048993541db4e572",
        "0x8771ac12777b4cdefefe53f259f73065f7d74518",
        "0x9c72a3826b400da43e7ee17b1cfe8b126cfae8b8",
        "0xdb4dbb7f1ecb76e7ec34b136a0a9b03fe65ec3eb",
        "0x34a500632be5498a463fadf5be7258c1cf7bf52b",
        "0x41bba2dba81f676b270acaee71284286b50afe3f",
        "0x6c0bc37ef59a42fe3eeb3f6dd3f92544cbc22b5b",
        "0x51e6db468293197ee3f242853222c6be0758a5ee",
        "0x6954f7add88b0c0a2761a5dd0a56913df88894c8",
        "0x9e6e058c06c7ceeb6090e8438fc722f7d34188a3",
        "0xe6876aa0282c3d050bf131c8f0bb93330d256cae",
        "0x964cdac9d3ae3755498e6d9ac0a8f83083699351",
        "0xf2d3b8b91eee6073b87f8d3e36a64322837c4859",
        "0x99e4b3a0217f7e45815cc7726caeec63689a016f",
        "0xb6645b1369597d0abcafdfb840417025a8b6759d",
        "0x658cfe0624d96f1bd2e1b19b13de644dde66d4e5",
        "0xccff69a21ef1c8e25bda6b7e048d0026e9348f51",
        "0x625d271f634ee0804ccc573c4679aa3aee475b62",
        "0x6da168b10bc3632fd3d594795ad71a8c55e836bb",
        "0x24665e692610a4808377b22a2a3597dbf472e5e3",
        "0x6db39feb6d010dcf57db5ef7551b0c3f70a1c0c5",
        "0xc601c9100f8420417a94f6d63e5712c21029525e",
        "0x68d8108f6fb797e7eb0c8d9524ba08d98bf27bcb",
        "0x88d239fcf4dc6fe988e1818db7a0666619bac674",
        "0xf1d10b7d436ae18d6551b8c8e2fa7802597823db",
        "0xc2b48e8c8aa2fcf98d56a100fcc6c9be351938f5",
        "0x16ea2e8c19cea329b46ec65050c1c3b9ae375d93",
        "0xa772e930a5c8d9ee589d1a5efd119c07ad8ba40c",
        "0x6e7f02f0030f7d2bfe96b04280921eb4eda2e9db",
        "0xf4903099e91eef9ae271e6b89c98e0e4263e7b45",
        "0x399343d37f555fc419ab9476ab5c9d87679ed246",
        "0xead7d3594bafe14da64a4188b22d131d4e3489a7",
        "0x97cdd8176084b24ae8a385d4ea9177c31ba0022b",
        "0x408db9f6891817b2be2bdf8f29edaaf27bc6ba69",
        "0x84c4cdfe829bc06a7fd0895a2f2244df62179f0e",
        "0x05efb12101fc22dbbdb9ad9ded99575329d1b81a",
        "0x2e83dae89f1833b4d9c3114db23e6c37754bc884",
        "0x325409632bccffac706d378a2eca57cafa21ab11",
        "0x2a5c2242656db68ff6fc95156ab8632f0cc1a07f",
        "0x4895726f1d462ff3ea45b1cd820cce01bfa75bca",
        "0x599a3839b20eb05aee8b5ad949a3b0272fcbba88",
        "0x0319e30f0fc7e1f469b7ab28ba006119cad8abd2",
        "0x674c9dd3dd7db9e79d7e1170a2c5645f258ba225",
        "0xb4740ddbec2e97b4c978aaf21612a611cbf98257",
        "0xa101aa3eeed37700214ef706104eb127a84414dc",
        "0xbd6de115a1480b2b65b6eb854177f4ca56188deb",
        "0x0ea47c52753f5130f48b59b9641b859a06b6caee",
        "0x6a07ea36da7850cc89be2523eb9423fbe7237061",
        "0x29db7f6dee7eccecf79da574edfee51fd73fffe0",
        "0x332df9f90436cb5240e155b46e467865fb8bc358",
        "0x792b62f48bcf3cf086bc6ccf0d1227c39908c989",
        "0x0dc678aadbce30b77b05aaa8eec7fe52d0e5b0e4",
        "0xea69c34b1c2b9f08157a1fae374a6a9cec464056",
        "0x3477981966c3cd4baa816fce3e31a660454fb92d",
        "0x22dd6267bc2682a6001e0adc80dafa88557a08fa",
        "0x8d1dbf65227265345c538084e1db400adc6107ae",
        "0x214385ae66a2f87d2e7ee09de1b99e014b6bdf08",
        "0x68c7e699899cd784faf001f22e3831b55faac7db",
        "0x1e160ceef93936b117e61ff3f90dae28f0bf2bfa",
        "0xb38b0f20f1a3ac4289db19a462ed658360969305",
        "0xb4466ed38fcedcb50797475605fd0070d77ee02b",
        "0x0e203d5140a31fea81865df063ba569235f4fdd5",
        "0x8e514e93090b9f20073c90cf2da189a8d942d51c",
        "0x9428f1af7c85b9fe038f99d1eceed3ed6bb4efae",
        "0x5a08291223870ae19c04f7f26bfdf2ebd86da678",
        "0x2a6715c1bf683628a60c67368b8f45862a817932",
        "0xc794470b838fb849e164ec1a0b033d3c6d0c17a8",
        "0x42b269df1d375eaaa3926681c866ff338fbd4120",
        "0x6105e7988df4404fce765142761c3fb35e0bd883",
        "0xf22b63410e5a43d19e7a11e004ef1d270d56a7f6",
        "0x1892f731b68d58909a02310594e8b40d8b8533c4",
        "0xc2f9a5eb4cd290edd2bd9b327d38ec571cc26d45",
        "0x8ed118482d6b8ad89ec899862ee0e4fa519fd605",
        "0xed5596ee7b4e40400517c561033a8f5c61269f10",
        "0xa582aa7a0b7378e80fa8ee395a86a49180956451",
        "0xb429b535030a852b6030f362d9f2f2f42f50beb2",
        "0x8ca038cb38b700477dd132e60fdd462c2ae93c5b",
        "0xca21aa8a210b4b1ea2755186c9c970233e2264dd",
        "0x6aa01aca42970c6ac24882ec4e7e5b0a82da033b",
        "0x6873599e05ae7d93080f63ff8b76491db3d7edff",
        "0x12b0c467c732f9c7d16ed19d4026eb6be46be7a5",
        "0x04166367bf59c6be53a076ce0c0106f2ed478046",
        "0x391630cc73a8c567e9af52ef31c9b04e2b4a1b3d",
        "0x7cc463ec17c8183ee52f01193ee7c0f42b80f982",
        "0x6939c24777f2d374771c8b1290c3ee630d4b0953",
        "0x413c562964428e688d611037ad40c6c2d8d70850",
        "0x98de0a6f0ea80b68d6300a38212b4adc2b923f10",
        "0x3107d96c084fae112a58424ef57d6bc315998fe3",
        "0xd2f0a570789f4577a0e95df6969d8444ef505c57",
        "0x039d19eb26a2169f9aa8e018182d074cd9c510c3",
        "0x2f9d8d5af5cf5ebf2c8149c43d78085836ef6043",
        "0x11b1b186416921c10f21a8a5d8dea62cd703ac9e",
        "0x6f1ef7840a1fadb0423bb780a757109ea64a7c86",
        "0xc3f7e5baf525a1ff20d0a0c42e48948d428d9a07",
        "0xfd81b4c1f38fa189c9a8f941cc10d5e620020ef4",
        "0x0c4482f1f764d99bb6b2f8b4b2545b5acefcac6e",
        "0xa91d219e839408af95b1c4ddbc5854bc427ed6c8",
        "0x651b5d90216d140d10cfb401c81950f9bf430ec1",
        "0x7b74125ea333754edcdd92c11bcb5ee64601cdef",
        "0xb45470a9688ec3bdbb572b27c305e8c45e014e75",
        "0x1574c2cd8022edc000c62e56ad45a585e344c085",
        "0x70cdce505907d4fc6029dd5981a94d376e5eeb17",
        "0x879e27032accd64f6de5db15f6e10a32f9d8618e",
        "0x3bcb89c62bf212febc54c1e544b9452ae844532d",
        "0xeb6d29e902f4e6d743331eedad2971ec25349110",
        "0x3160bc884a3351436f4fec13e2fdcba020581e26",
        "0x6ca78b892023b800c4ea3ae42be583ffd6acfe1b",
        "0xeb2833cbf3fe2e1142c1b661cfee8219bc7681c6",
        "0xb5fbebe3b1e94b5ff0a0e0352cf02b17622a9a43",
        "0x77027ccc7fcc52fc4186935357c47efdba407697",
        "0x852980b96676cef509a565e5cb84c15917dbf300",
        "0x497a620db9c93e77a444a6f511f0a744275fe5d1",
        "0x3ce41df330b74f6e51f3dba1ab99c4ebbc1f1b35",
        "0x67dd07ef4cfe619940c7489523fa33cd189af2a2",
        "0xc5e73e71639bb22725b90f9011e67b3fc6db5abc",
        "0x24e6279ad2e7b1dd7bfd82744d7793166e29fa3c",
        "0xfe4c05233543f2881ae4c54240fd4a190d495285",
        "0xecdc299cd02ac7037232089fb599260a1b59b9a3",
        "0x9ee059d06a9f8eddc16ed1d24160dc530dc75be7",
        "0x8a6ebf1d3cda0323ca0143e43a20b866ab8f8c36",
        "0xe1eecc3ead825b421a2e46c6f9d310846e4436d8",
        "0x7ad4a18e2619cc1dbca48178f1b97de73bbe2764",
        "0xd328097602b9cef563a294eb940f6f9f781a2e0f",
        "0x93a208b0d7007f5733ea23f65bacf101be8ac6cd",
        "0x6a2c0c6d333b7bdd2b0c961b8d607894d2bb5b51",
        "0x6e9c24e6c635dcb588236c0e1ff62064fbdd6887",
        "0x7e84638efcf13bb710d591048532ab09990b7c4a",
        "0xee49b865670383a3877ef0cac97fb69a5d680bd4",
        "0x8157b9805e2c984774374740c569f58211e6f8ee",
        "0x4c2a5bf2e280dfc90826cc2f81dfbbfa431fea1c",
        "0xbaf6610405bd8c60432fbd329885dae617e647ca",
        "0xbd4984f0cd2557519388594d79d88dab3a97f74a",
        "0x7e7d937f8919be5b11978ab637c1581677224a8c",
        "0xeccea681575a0d1297d6077b2aafa1564aa8f2d5",
        "0xfdf0b022741ad2ff9076c8017d0194bee28ee1f1",
        "0xc57b1f6d9b66d528af1cd2d0a7a2ffa389cd3a10",
        "0x790b46e6dfe304a95c7c3836ab761b29513ccc59",
        "0xf404ebea304029172eab6efdb381dbb775f6778d",
        "0x001a9d8fc5916cf5a1c43dbca0e937006fa1412a",
        "0xe036192f91eb033d1fe561fbe9eee91aa2a2b999",
        "0xce69f1a6fe78d76ced76547d9cb6d660dc038650",
        "0xc0b52558eee9b1f1b80feab1e1963ef9f0f2a8fe",
        "0x0249e0913088525154dbcf96466a068894054fb6",
        "0x9049e18574e1ebe1d718d61a4308c0b843dfa2ec",
        "0x78fd2dc9f19ad0d6044752cb27992752dd726a98",
        "0xb64281dc5bbf20ec2a877891024aaf3cc900a1e5",
        "0xc2d21592f25273f5778e39888b39bdd78a3c91bd",
        "0xa0f8f24f99994a2ebf930de888babd00b123b53c",
        "0xfdefc184d60ca6ae5965fbcf0014e8f19f728095",
        "0x66fb23e3b6acb232bd32e61ff609afff5439bc9d",
        "0xa81599eac76045fce181ae0d83a5843c39867ad4",
        "0xf4e14df4a759bd411bcb7eaa7aa90300825b4963",
        "0x5d813de402f4a27aa18abdf12c82a688e7e7da68",
        "0x015e0427d83d4c00746542eb2a9cf073f1ada5b2",
        "0x96668cf0cb358ecfa05873285696e0c23577e50a",
        "0x9547788e6f7576d279065fdd0c62eafb74455858",
        "0x654381f8c38e92a262ea663b41d70d2f2896e7f2",
        "0x9222c7e7c839b26ed2d498897fdcffdb229ae111",
        "0x8bfd93f9e6bdad3f95cd28f8fc1f81c80e9003e7",
        "0x3c633c17ed7406c6ced88e6dd46d20fbdc472364",
        "0xbd7882ab47157a1b2ab91ef23ff59425bf01dda0",
        "0xc558a7ad80ae26fbfa9ae507d53729840c91ae5d",
        "0x96dc1d711c6447b3f6fa7f5d4cd2543630ba3e61",
        "0xb5b523df6eb98dfcd982ab2f8d2127797d591919",
        "0x6342e522f51d0ce38a1bd75c7abcbd509a027763",
        "0x0e207754375a7d8a4ebfcc68aff0d79178a71789",
        "0x5e8c4503447f17b503b24c2c7aa8d07ccf9e905f",
        "0x36612217a8a8f85eaaa657467138fe3a90d98e62",
        "0x366e6c67bcf15ba99b56842720f57974c7ee5315",
        "0xd60166e0497a22f9edd132c75ba380f1b019358a",
        "0x68e4efa4df43d52c1d83e44d7044f0b3fc62ded0",
        "0xd3d99ab6981587d5522854ca370726eef63a8e4d",
        "0xffbaa0de31cd06c0031682e6e991b2515e71192e",
        "0x382ff159a065a0bac0580c2f7d9600634a817404",
        "0x1f4f12fd18d569212b5ec4bdbd1cde844952a4f4",
        "0x486c0c2e408c68f786aac41dccfeac62341ab07f",
        "0xb0079838de6f47b67c6d316d8aedcdd1109bd6e7",
        "0x5f6fe2a7d4e08d0c9e81135de58cdc5c2a3230f4",
        "0x0e5bad4108a6a5a8b06820f98026a7f3a77466b2",
        "0x00689b8def7a3f0bb3e3501ef87ed4de6a38215d",
        "0xcae225d77534ef0d20d8e42d97e2fb84002c7f05",
        "0x9b418ca3c64d8f16f6e2101cf96becd9aa0a61a4",
        "0x7ac6df8264dc34aae8c7f7f856b931b6310ad2cb",
        "0x3e392ed40012b06f0784086c275b4d3427cfca8f",
        "0xec042a1f04ce1642eaf3122e9059e81b5ca0b0de",
        "0x8015333e03c727cd0a843e99f8adc82f1fd423c7",
        "0xa3c596a6037835ce0c2a4037488e25b09996ce6a",
        "0xf6e81ef6cf7a2200fe769ab0f4555aef809498b2",
        "0x86a6820f8435a7a7223d72c8dc65553a949e6a20",
        "0x1f201cb9f03a243855bbe645ba72e24d58dfd5d2",
        "0xf822277e75e343049c58aaf49383ad961a23d6ef",
        "0x8915ea6d081b68f80004c579a518fb645db71afa",
        "0xc0ab0b985b9c8db2a0064e9db0093e259bbad632",
        "0x50e0386beffb1a6b8dfd0e09cf93b462aea2706f",
        "0xf62bdafc4cb3808346c5854c0fd129f2a22c02e0",
        "0xdcdc977e90ad7980d8bba4090dbb0eb70530b845",
        "0xb41adf0f515ca3e9d2f3bd9f991641982977fcc7",
        "0x9c972d06eceee9dc08e2d295742d2045f8e54fa2",
        "0x90160ae7b93d999bdcbddd5064eec787dc63fe3c",
        "0x3b6ff039272c26207efd86044810e92f17540d46",
        "0xf3abccc785165d1600def7f44c505dbfcddcf0e4",
        "0x04261f3a4f4e244b80ed7e3d8b7ff28abd6c4dc9",
        "0xa784b62b78362541d3e75108c5b4daf0fcce1af7",
        "0x33df8226809c6d95adf488f990cbc7a495278779",
        "0xb92a10ad1cd0e05647331d669d6b291dcbe0b933",
        "0x95475bc28eddf29a043f59f19642eaa77d51d79d",
        "0x101eb8ecdabdb43826726269b0257e6b6ed11b33",
        "0xaf12d4b9cb9914be02535f474f1d2da9c87ac87a",
        "0xd29c46af6847c409d037332354639b56abd409ad",
        "0xbfb0f86dc541fcc5b6949589dbe67c4785c2691a",
        "0x9e1b8b92e5b979e566c3d6b17dbbf5cac8d9092a",
        "0x366ff9a74a8a110cb054106d26f6c876d7b3437d",
        "0x44646c1823433071cb4d60e90738161f7a056cc1",
        "0x03f29b3a81b86ef68f1682b497a62cfc4d3ee73b",
        "0xbc84810838ea3cee8163cffbba78736b24293b13",
        "0xb56e0bc0ba4735887ebd29933589216cd619fa19",
        "0x1122c8c1fd75ad676ece56a93bc1e39c7d348e7a",
        "0xb4c998256598a3129c02ff265d5174763743031d",
        "0xcfed01b111deaca96d9595f9530fff2722e77e43",
        "0xdf51b66cd3090509cdb865b25a87a7629605383c",
        "0x2d3d1c6dea68faa08aef5b977306c79d55c0015e",
        "0x0db688a81890ed731f3e935323707ab1f4cec9cc",
        "0x408eb20027a1dc88905c167788a3e0eab1d5c816",
        "0x3547bef33259b3e6ee5ebedddb5114c559025018",
        "0xe23bd6fe3a2bccac3ad85517f142cb934329715a",
        "0x84a642d8f5af837256eac4c46264a0d53d66fd65",
        "0xb757df95d845f8deb8b4ddafe74fd54ad2b377a3",
        "0x96d3dfdfd297a3fced8120484276708c10bacbf6",
        "0x97e7d075167fe10167a835b8623d55dbb2824ab3",
        "0x25365e93c880681a92c91bac112018a763c09e50",
        "0x71a2040751c495c6a74c26d4506b3d545c249c80",
        "0xf0282b060bb97d392af2b62303156a36ec487d0a",
        "0x68bec8f529f8e51a6deb56354a4c692dd9a748b7",
        "0xaa2b2c0122d9902e41b60af819a2ed786e7981b6",
        "0xfb1e69e257e6dd3018e2102ced4c6e044d0b2305",
        "0x40bdefb6dae9e82165876250c3d4e15343184504",
        "0x982ebcde433607266e8c22a8d348a1cce2eddc21",
        "0xd1bc3491d5fd54089593e6c00fed85a931696bac",
        "0x664fd1a25eca57a02cc1d8249dee839b9fd7f755",
        "0x73a91f97a8fae0de515b0df99a0a58b7c996e498",
        "0xce871133d7dfb96f282b6f031bf32380b41af5e2",
        "0x9ade8e39f077a61960289c73c429792b3918c410",
        "0x2bf674b122d8a5b1219466c8a1dab91adc1b637f",
        "0x66d4558facc464930f274df992af771b7b0b3c0a",
        "0xef03bcbca0b53bb23400b459ab0f0ddab31871e6",
      ]
      this.isRecalculatedYY = recalculatedYieldYak.indexOf(this.account) !== -1;
    }
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
    grid-template-columns: repeat(3, 1fr) 135px 135px 135px 135px 70px 110px 22px;
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
          display: flex;
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
