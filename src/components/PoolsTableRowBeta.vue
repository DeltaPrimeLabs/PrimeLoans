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
                 v-tooltip="{content: 'The balances from Yield Yak pools are being updated. Withdrawals will be available soon.', classes: 'info-tooltip long'}">
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
          tooltip: this.isRecalculatedYY ? 'Available soon' : "Deposit / Bridge",
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
          tooltip: this.isRecalculatedYY ? 'Available soon' : 'Withdraw',
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
        this.setupActionsConfiguration();
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

        const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, provider.getSigner());

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
      if (this.isArbitrum) return;
      let recalculatedYieldYakAVAX = [
        "0x001a9d8Fc5916CF5a1C43dBca0E937006fA1412a",
        "0x00689b8dEF7A3F0bb3e3501Ef87Ed4De6A38215D",
        "0x015E0427D83d4c00746542Eb2A9Cf073f1aDa5b2",
        "0x0249E0913088525154dBcf96466a068894054Fb6",
        "0x075E767cfe343eBf8D3F63390dc38d8584eB9832",
        "0x0E5Bad4108a6A5a8b06820f98026a7f3A77466b2",
        "0x0e207754375a7d8A4ebFcc68Aff0D79178a71789",
        "0x132754c163Ff27138d0f2a12bA8678f58F4a3326",
        "0x1574C2cD8022Edc000c62E56Ad45a585e344c085",
        "0x1F4f12fd18d569212B5EC4BDBd1cde844952a4f4",
        "0x24E6279AD2E7b1dd7Bfd82744D7793166e29FA3C",
        "0x29dB7f6deE7EcceCf79DA574EdFEe51FD73fFFE0",
        "0x2C9B17C98FaB09b412f7edaB37624F346b7De35E",
        "0x2e83dAE89F1833B4D9c3114Db23e6C37754bC884",
        "0x3160BC884a3351436F4FeC13E2FDcbA020581E26",
        "0x332dF9f90436cb5240e155b46e467865Fb8bc358",
        "0x36612217A8A8f85eaaa657467138Fe3A90D98e62",
        "0x366E6c67BcF15BA99b56842720F57974c7EE5315",
        "0x382ff159a065A0BAc0580C2F7d9600634a817404",
        "0x3BCb89C62Bf212feBC54C1E544b9452aE844532d",
        "0x3c633C17ED7406C6CeD88e6dD46D20fBDc472364",
        "0x3ce41Df330b74F6e51F3dbA1ab99C4EBBC1f1B35",
        "0x3e392Ed40012B06F0784086C275B4d3427cfcA8f",
        "0x486C0C2E408C68f786aAC41DcCFEaC62341ab07F",
        "0x497a620dB9c93e77a444A6f511f0A744275fe5d1",
        "0x4C2a5Bf2e280dfc90826cC2f81DfBbFa431fEa1c",
        "0x5D813dE402f4a27aa18ABdF12C82A688E7E7Da68",
        "0x5E8c4503447f17B503B24C2C7AA8d07ccf9E905f",
        "0x5f6fe2a7d4e08D0C9E81135DE58cdC5C2a3230f4",
        "0x6342e522f51D0Ce38a1BD75c7abCbd509a027763",
        "0x651B5d90216D140D10cfb401c81950f9BF430Ec1",
        "0x654381F8C38E92a262ea663b41D70d2f2896E7f2",
        "0x66Fb23E3B6ACb232bd32E61ff609aFfF5439bC9D",
        "0x67dd07Ef4cfe619940c7489523fa33CD189Af2a2",
        "0x68E4EFA4dF43D52c1d83e44d7044f0b3Fc62deD0",
        "0x6CA78B892023b800C4ea3Ae42bE583FFD6acFe1b",
        "0x6E9C24e6C635Dcb588236c0e1fF62064FBDd6887",
        "0x6a2C0C6D333b7BDD2b0C961b8d607894d2Bb5b51",
        "0x70CdCE505907d4FC6029Dd5981a94d376e5Eeb17",
        "0x77027ccc7fcC52fc4186935357C47eFDBA407697",
        "0x78Fd2dc9F19ad0D6044752cB27992752dD726a98",
        "0x7909acc2C9fBa6Cf01CbA70E5F00E6B47Ca68B55",
        "0x790b46E6dfe304a95c7C3836Ab761b29513CCC59",
        "0x7AC6dF8264dc34aae8c7f7f856b931b6310Ad2Cb",
        "0x7B74125eA333754EDcDd92C11BcB5Ee64601cdeF",
        "0x7E7d937f8919BE5B11978Ab637C1581677224a8C",
        "0x7ad4a18E2619cC1dbCa48178F1b97De73BbE2764",
        "0x7e84638EfcF13bb710D591048532AB09990B7c4a",
        "0x8015333e03C727CD0a843E99F8ADC82f1Fd423C7",
        "0x8157b9805E2c984774374740c569f58211e6f8ee",
        "0x852980b96676CEf509a565E5cB84C15917Dbf300",
        "0x879E27032AcCD64F6De5DB15F6e10a32F9D8618E",
        "0x8C31E4fD0350A4E2920123A81b38AE58292B176a",
        "0x8a6ebF1d3CDA0323CA0143E43a20B866ab8f8C36",
        "0x8bFd93F9e6BDad3f95Cd28f8fC1f81c80E9003E7",
        "0x9049e18574E1EbE1d718D61A4308C0B843dfA2EC",
        "0x9222C7e7c839b26ED2d498897fDCFfDB229ae111",
        "0x93a208b0d7007f5733ea23F65bACF101Be8aC6cD",
        "0x9547788E6F7576D279065fDd0c62eafb74455858",
        "0x96668cF0cB358ECfa05873285696e0C23577e50A",
        "0x96dc1d711C6447B3f6fa7F5d4Cd2543630bA3E61",
        "0x9B418Ca3c64D8F16F6E2101cF96BecD9Aa0a61A4",
        "0x9ee059d06a9F8eDdc16ed1D24160dC530DC75be7",
        "0xA0f8F24f99994A2EBf930de888bABd00B123b53c",
        "0xA81599Eac76045fce181Ae0D83A5843C39867AD4",
        "0xB45470a9688ec3bdBB572B27c305E8c45E014e75",
        "0xB4740DdBeC2E97b4C978Aaf21612A611cBF98257",
        "0xBAF6610405Bd8C60432fBd329885DAE617E647CA",
        "0xBD4984f0Cd2557519388594D79d88DaB3a97F74A",
        "0xBd6dE115a1480B2b65B6EB854177F4Ca56188dEB",
        "0xC2D21592F25273F5778E39888B39Bdd78A3c91Bd",
        "0xC558A7AD80AE26fbfa9Ae507D53729840c91ae5D",
        "0xC57b1f6d9b66d528aF1cD2D0a7a2FFA389CD3A10",
        "0xCAe225D77534EF0D20D8E42d97e2FB84002C7F05",
        "0xCe69F1a6fe78d76Ced76547d9cb6D660dC038650",
        "0xD2080492c161628c962749F1C41FF6dC211fEEFa",
        "0xE036192F91EB033D1FE561fBE9EeE91aa2A2b999",
        "0xECaB99D718D199F652D6c98A80aDEEce5eef644C",
        "0xEb6D29e902F4E6d743331eEDAd2971EC25349110",
        "0xEcDc299CD02AC7037232089fb599260a1B59b9A3",
        "0xF404EbEA304029172eab6EFDB381Dbb775F6778D",
        "0xF4e14df4A759BD411Bcb7eaA7AA90300825B4963",
        "0xFDF0b022741aD2Ff9076C8017D0194bEE28Ee1F1",
        "0xa38e5bBCeb22Aca04F11D3a3d7E4180ecFDebCD7",
        "0xa70d7F7b7Ff356E904B5f7Afe2f41e8F9005434E",
        "0xaD4C9C0d821E9BE46161C89D332AF690f7abCAD2",
        "0xb0079838de6f47B67C6d316d8aedcDd1109Bd6e7",
        "0xb5b523dF6EB98DfCD982Ab2F8D2127797D591919",
        "0xb5fBEbE3B1E94b5Ff0a0e0352CF02B17622A9A43",
        "0xb64281Dc5bBf20ec2A877891024AAf3cC900a1e5",
        "0xbd7882aB47157A1b2aB91Ef23FF59425Bf01DdA0",
        "0xc0B52558EeE9b1f1b80Feab1E1963eF9f0f2a8FE",
        "0xc5E73E71639bB22725b90f9011E67b3fc6Db5AbC",
        "0xc7A53BbC9185a1d7878359003254C244Ae83C60F",
        "0xd328097602b9Cef563A294EB940f6F9F781A2e0f",
        "0xd3d99ab6981587d5522854CA370726eEF63a8e4D",
        "0xd60166E0497a22F9EDD132C75Ba380f1B019358a",
        "0xd9F4da967FaB291E475795c877504450C26DE279",
        "0xe1EecC3Ead825B421a2E46c6f9d310846e4436d8",
        "0xe53E02040237Ab4C521e93636a66C757C6062AAB",
        "0xeB2833cbF3Fe2e1142c1B661CFEE8219Bc7681c6",
        "0xeCCEA681575a0D1297d6077B2AaFa1564Aa8F2d5",
        "0xeEb42b37aFD1A92Fa5e8E99FB335b93B445fDE95",
        "0xec042A1f04Ce1642Eaf3122E9059e81B5ca0B0DE",
        "0xee49b865670383A3877eF0Cac97fb69a5D680bD4",
        "0xfFBaA0dE31Cd06c0031682E6e991b2515e71192e",
        "0xfdeFc184D60ca6ae5965FBcF0014e8F19F728095",
        "0xfe4C05233543f2881Ae4c54240fD4A190d495285"
      ].map(el => el.toLowerCase());

      let recalculatedYieldYakUSDC = [
        "0x004889f848135b9CE985386De01FE0c17fF32a4e",
        "0x075E767cfe343eBf8D3F63390dc38d8584eB9832",
        "0x08E0D81F520452bDE9B9503cbE86bce004D28cBD",
        "0x08Fe4f98d1447Dd0429e68725a8406484db51646",
        "0x08b776a6907303558433be9B9583f21d41a58DFd",
        "0x09167154e444884B06d6608CE842Ddc3a768b22a",
        "0x0A26e3ac3B672418241C395fDc108454772726F6",
        "0x0AAF0D1eAA181131b9Cd4cd9B8B9440E2cD57bb2",
        "0x132754c163Ff27138d0f2a12bA8678f58F4a3326",
        "0x138D146ca9Bb6db4f0756fce035Bed5C4F2ed8F5",
        "0x14E895102acd7D639C76276094990dCfDD20102F",
        "0x16ea2e8c19Cea329b46EC65050c1C3B9aE375D93",
        "0x198A8aAc7A22cCcfB8b8411Cc7E594AD58625D33",
        "0x1De519A0D3a2BfCcCA5a8C58c91B215B3723DEEF",
        "0x24665E692610A4808377b22A2a3597Dbf472E5E3",
        "0x25a11813331854e8315C0754371CDA8131b19088",
        "0x276EC22119aedc41Eb91752AA463Dff68076D482",
        "0x2C9B17C98FaB09b412f7edaB37624F346b7De35E",
        "0x34A500632be5498A463FadF5BE7258C1cF7BF52b",
        "0x38199397111Feb1461e5C1c35D36a2B1358d6437",
        "0x38274862B7124d6476311b99693f7f1f80c86D31",
        "0x399343D37f555fc419aB9476Ab5c9d87679ed246",
        "0x3DCb67aB54ebD6e134C9219516A196705dC3bA59",
        "0x3a0971F352312303ceED056b12d542b30CFE9796",
        "0x3aa0C2753A3D5C36D233867B5f7F4F471c0e256A",
        "0x3c19B8a4847EFF3c8Fb155d3888A2d2dF733a38b",
        "0x41bbA2dBa81f676b270ACaEE71284286b50aFE3f",
        "0x44A4d3a6ED59E16d89bc79637D94Be9D113416E8",
        "0x49Fc0865B77C9Ba21781e6A961C2f7A6474b9E47",
        "0x4d95C57f61f0edA120eC7F973cd8C5DAEf40c51A",
        "0x51E6db468293197eE3F242853222C6Be0758a5ee",
        "0x54a92a5D09F87554314812568A2bC40A9E931bfA",
        "0x54b2d9aEf22d594B26E7f61bB51548066e137270",
        "0x55b675FC360714d6ceE43A58eB05673339D7Ba36",
        "0x59b81377DB42314c8842FD033e813fa6820F3dB9",
        "0x60360c35bB3Ae091C45479D52e84fc7209cb8f11",
        "0x625d271F634eE0804CCc573C4679aA3AeE475B62",
        "0x658Cfe0624d96F1Bd2e1B19B13dE644dDE66D4e5",
        "0x6676055aB3f5b91092278EbF4f1e57c842B41d81",
        "0x66DB467a76Adc2D162B0508A198EDbE3f7271109",
        "0x66d4558fAcC464930F274dF992AF771B7b0B3C0A",
        "0x68D8108f6FB797e7eb0C8d9524ba08D98BF27Bcb",
        "0x6954f7ADd88b0c0a2761A5DD0a56913df88894C8",
        "0x6c0bc37eF59a42Fe3EEb3f6DD3F92544Cbc22b5b",
        "0x6dB39FeB6D010Dcf57DB5eF7551B0C3F70A1C0C5",
        "0x6da168B10bC3632fd3D594795aD71A8c55E836bb",
        "0x6e7f02F0030f7D2BFE96B04280921eB4eDa2e9db",
        "0x6f467cDa73D34594498d21Bd29Cd2AA58b4fbA20",
        "0x700Be855745f7F3f017473ed03e8a9af28E08Acb",
        "0x716547F28fC3a2efFA9913C7E3894fDb5566f277",
        "0x71B9E20a2DDB80eB3b2F7A800cb7B039948283DF",
        "0x78931575e4B68204D916002aFBE998ff6b45AA52",
        "0x78Cc023162C3D105B833CD9B97048C3385c829A6",
        "0x7909acc2C9fBa6Cf01CbA70E5F00E6B47Ca68B55",
        "0x7946BFbf6C23F1FF0e59f058F04Fbf5E2198416a",
        "0x7E7d937f8919BE5B11978Ab637C1581677224a8C",
        "0x7Fd57Cfeb265841044585f57C11DF7a948Fb2997",
        "0x7f4e5705F8e436d4b685fFbfFBfe6b385096CB4C",
        "0x80751eAcAD9431Ec8b86B857777383dc07C5603d",
        "0x833EE32fB08c742e5A646E7FA5750Db3CeAF158F",
        "0x8771aC12777B4CDEfefE53f259f73065F7D74518",
        "0x87f55E8b567A1169B5Ce564B97744f3330B0c084",
        "0x88d239fCf4DC6fe988e1818dB7A0666619bac674",
        "0x8A757ab0de17D3D820A6E2c8516ACC239B4b4bFE",
        "0x8C31E4fD0350A4E2920123A81b38AE58292B176a",
        "0x8D8BDa55ED78035947597CB64F6ACa72739f0580",
        "0x8dF5787aaFAee95B4f6b8D66A94538d0b3731c52",
        "0x8f5126847d6743CCB98233E0883615fc9beC6545",
        "0x90A5824dfc2f7b9D7AB41343129feb4B8081dB20",
        "0x91D19f8806D118A3554D94041E382F1b18559863",
        "0x91E2441F989EfbA45f8C42FbAccC43B8E65D71d5",
        "0x91d659a359348d4A17A726E822a17d7B01499d86",
        "0x920209830daB542d3Ee271439590d9664eA03BD2",
        "0x964cDac9d3aE3755498e6d9aC0A8F83083699351",
        "0x97c2eA4C75Ee00a29bAEa35cCB63f8CE9F17890B",
        "0x97cdd8176084B24ae8a385d4eA9177C31bA0022B",
        "0x9934c66Eebc492708964fa8C3Ef25d181257ff41",
        "0x99e4b3a0217f7e45815CC7726CaEeC63689a016F",
        "0x9c72a3826B400Da43E7eE17b1cfE8b126cfaE8B8",
        "0x9dA1A931a572776c98DC87E7d9Aa78784F875866",
        "0x9e6E058c06C7CEEb6090e8438fC722F7D34188A3",
        "0xA2D38427536E0BB2bfC07223cbb6B3350987a885",
        "0xA772E930a5c8D9eE589D1a5EFD119C07AD8ba40c",
        "0xA877502FAcC63f9F0585e523e82Db5CF9B38cdfa",
        "0xB3bE1649cce25C2E72c56492efe4c515008a6E2c",
        "0xB4aEEfb9b7eBa97D34791C1822C25D2D55f936Eb",
        "0xBc713613b03c3D71e68Cf83B98A4bCEC3F127Ce2",
        "0xBca921c66232319ff912f1e2159Ed9D5eD3A4aAe",
        "0xC0835CE87DBd79E6C38C1c672155e7A4f0216CE4",
        "0xC3FaFc13f7b58fc205e7962B5F67FBA2C678c33d",
        "0xC601C9100f8420417A94F6D63e5712C21029525e",
        "0xCE27e7F85132C133DC39bb54BCB7eA7a3Ae1b424",
        "0xCb8B0567993258e02A17dc9895Fce424Fb1740FE",
        "0xCce1867ec3eFc961C1E981fEB54524761EcC72D4",
        "0xD2080492c161628c962749F1C41FF6dC211fEEFa",
        "0xD23588799D5bc9F9D0f1B7e2a469877EF1957017",
        "0xD5DF955c8EE1a98A443172d7F5d3eDD62eD11Ad0",
        "0xDB4DBb7f1ECB76e7ec34b136A0a9B03fE65eC3Eb",
        "0xDB841598995C773a90a7166fF6e2782Bc96d41ad",
        "0xDDC19B309f65BD7263A873a29c8ea8651b7de2bC",
        "0xDe5848daECc77d00C056Dd06393a2497AA2caeC2",
        "0xECaB99D718D199F652D6c98A80aDEEce5eef644C",
        "0xEDcE05d6c882C39DDBeBE7c33286C5D2A2876B66",
        "0xEF03Bcbca0B53bb23400b459ab0F0DDab31871E6",
        "0xF2d3B8B91eEE6073b87f8D3E36a64322837c4859",
        "0xF32B445934Ff05D9EC488485A6132fc8e309b42d",
        "0xF724a3bd87cD41b032655f8D68d3b36fACe87977",
        "0xa38e5bBCeb22Aca04F11D3a3d7E4180ecFDebCD7",
        "0xa46a81C50D9ba0FC2C85d26aefD05A88c4e0EC07",
        "0xa70d7F7b7Ff356E904B5f7Afe2f41e8F9005434E",
        "0xa72C59EBcCF224f5aF8C59682536704305992246",
        "0xa80FA66f66e7EddFEfA0a617B49f43dd713FD086",
        "0xaD4C9C0d821E9BE46161C89D332AF690f7abCAD2",
        "0xae92b2AA078De01EdE8cbA8760023fF210eEA511",
        "0xb320b06dA220878bf0F7B66Acd0D399B8A8985CA",
        "0xb6645b1369597D0ABcaFdFB840417025a8b6759D",
        "0xbE83D4da84fB19978Fde9b31f688CbC2B02Be54f",
        "0xbc78b6B4a4433Fc9825738E131D75eD11D5Cd128",
        "0xc2B48E8C8Aa2fCf98d56A100fCC6C9Be351938f5",
        "0xc315799BA0411b74A38220d56432F7507C0FfA2F",
        "0xc7A53BbC9185a1d7878359003254C244Ae83C60F",
        "0xcCFF69a21EF1c8E25bDa6B7E048D0026e9348f51",
        "0xd1c5c8725446022951dAdBD40aC847eC78CF5B13",
        "0xd58ccafC31ce8E2e503F5DFc32FF54172bDE7E78",
        "0xd9F4da967FaB291E475795c877504450C26DE279",
        "0xdED492e1110073B6a98418c136297D2eb60Faa3d",
        "0xdFDfdb3711c7f902C1D099f9a8EcdcBaBa4607Dc",
        "0xdc018De548448EcDdAE3467d8cdb3af150783E0B",
        "0xe0527E66ED8C7e372007DE0d65A5Eb45caC53e07",
        "0xe2924D22815d746a89df88477d21EfD2df8f2AF9",
        "0xe53E02040237Ab4C521e93636a66C757C6062AAB",
        "0xe6876Aa0282C3D050bf131C8f0Bb93330d256CAe",
        "0xeC0a7aF6ec90688d299BEd762C4DB20fAd9897Cf",
        "0xeEb42b37aFD1A92Fa5e8E99FB335b93B445fDE95",
        "0xeaD7D3594BAFe14dA64a4188b22d131d4e3489A7",
        "0xee10223Db5269Ca0eefE488E7c47e25f7460B381",
        "0xee22B9596953b0705bB2dd6D598a07Ef708D815d",
        "0xee38fEcC24fc56813Be8a5c073612451A460CB7E",
        "0xf1D10b7d436ae18D6551b8c8E2fA7802597823dB",
        "0xf4903099E91Eef9AE271E6b89c98E0E4263e7b45",
        "0xf7054B5Cbb79F5f40c7610D94ecf26fBB5f8A696",
        "0xfB076dc52E7B750fB7779811048993541DB4e572",
        "0xfcb6Df91C6128f0d0947d46C64005fACf4aDE5F9"
      ].map(el => el.toLowerCase());


      this.isRecalculatedYY =
        this.pool.asset.symbol === 'AVAX' && recalculatedYieldYakAVAX.indexOf(this.account.toLowerCase()) !== -1
        ||
        this.pool.asset.symbol === 'USDC' && recalculatedYieldYakUSDC.indexOf(this.account.toLowerCase()) !== -1;
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
