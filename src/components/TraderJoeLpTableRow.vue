<template>
  <div class="traderJoe-lp-table-row-component" :class="{'expanded': rowExpanded}">
    <div class="table__row" v-if="lpToken">
      <div class="table__cell asset">
        <DoubleAssetIcon :primary="lpToken.primary" :secondary="lpToken.secondary"></DoubleAssetIcon>
        <div class="asset__info">
          <a class="asset__name" :href="lpToken.link" target=”_blank”>{{ lpToken.primary }}&nbsp;-&nbsp;{{
              lpToken.secondary
            }}</a>
          <div class="asset__dex">
            by {{ lpToken.dex }}
          </div>
        </div>
        <div class="bin-step"
             v-tooltip="{content: 'Bin step', classes: 'info-tooltip'}">
          {{ lpToken.binStep }}
        </div>
        <div class="sprime-early-access">
          <img src="src/assets/icons/icon_circle_star.svg" v-if="lpToken.earlyAccessRequired"
               v-tooltip="{content: 'Early Access is available exclusively for users holding $100 or more in $sPRIME.', classes: 'info-tooltip long'}"/>
          <span v-else class="early-access-placeholder">&nbsp;</span>
        </div>
      </div>
      <!-- To-do: Show price graph or similar one on click -->
      <div class="table__cell liquidity">
        <div v-if="lpToken.binIds && lpToken.binIds.length" class="active-indicator">
          <img v-if="lpToken.binIds.includes(activeId)" width="16px" src="src/assets/icons/check.png"
               v-tooltip="{content: 'The active bin is in your range.', classes: 'info-tooltip long'}"/>
          <img v-else src="src/assets/icons/error.svg"
               v-tooltip="{content: 'Your position does not include the active bin.', classes: 'info-tooltip long'}"/>
        </div>
        <FlatButton :active="lpToken.binIds && lpToken.binIds.length" v-on:buttonClick="toggleLiquidityChart()">
          {{ rowExpanded ? 'Hide' : 'Show' }}
        </FlatButton>
      </div>
      <div class="table__cell liquidity">
        <FlatButton :active="false">
          {{ 'SHOW' }}
        </FlatButton>
      </div>

      <div class="table__cell table__cell--double-value balance">
        <template>
          <div class="table__cell composition">
            <img class="asset__icon" :src="getAssetIcon(lpToken.primary)">{{
              formatTokenBalanceWithLessThan(lpToken.primaryBalance ? lpToken.primaryBalance : 0, 4, true)
            }}
            <img class="asset__icon" :src="getAssetIcon(lpToken.secondary)">{{
              formatTokenBalanceWithLessThan(lpToken.secondaryBalance ? lpToken.secondaryBalance : 0, 4, true)
            }}
          </div>
          <div class="double-value__usd">
            <span>
              {{ userValue ? userValue : 0 | usd }}
            </span>
          </div>
        </template>
      </div>

      <div class="table__cell table__cell--rewards-token balance">
        <!-- <FlatButton :active="false" v-tooltip="{content: 'This button will show more information about your ranking and collected incentives. While the button is not yet active, your Prime Account is already collecting.', classes: 'info-tooltip'}">
          {{ 'soon!' }}
        </FlatButton> -->
        <div class="table__cell composition">
          <template v-if="totalRewards.length > 0">
            <div v-for="reward in totalRewards.slice(0, 2)">
              <img class="asset__icon" :src="getAssetIcon(reward.symbol)">
              {{ formatLongNum(reward.amount) }}
            </div>
          </template>
          <template v-else>
            <div class="no-value-dash"></div>
          </template>
        </div>
        <div v-if="totalRewards.length > 2" class="more-rewards">more...</div>
      </div>

      <div class="table__cell table__cell--double-value loan">
        {{ formatTvl(lpToken.tvl) }}
      </div>

      <div class="table__cell apr">
        <div class="apr-warning" v-if="lpToken.aprWarning">
          <img src="src/assets/icons/warning.svg" v-tooltip="{content: `APR value is updated twice a day. Please check TraderJoe website to find the current pool's APR.`, classes: 'info-tooltip long'}">
        </div>
        {{ apr / 100 | percent }}
      </div>

      <div class="table__cell max-apr">
        <span>{{ (maxApr + boostApy) | percent }}<img v-if="boostApy" v-tooltip="{content: `This pool is incentivized!<br>⁃ up to ${maxApr ? (maxApr * 100).toFixed(2) : 0}% Pool APR<br>⁃ up to ${boostApy ? (boostApy * 100).toFixed(2) : 0}% ${chain === 'arbitrum' ? 'ARB' : 'AVAX'} incentives`, classes: 'info-tooltip'}" src="src/assets/icons/stars.png" class="stars-icon"></span>
        <img v-if="chain === 'avalanche' && lpToken.isIncentivized" src="src/assets/icons/stars.png" class="stars-icon">
      </div>
      <div class="table__cell"></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
            class="actions__icon-button"
            v-if="addActionsConfig"
            :config="addActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="(lpToken.earlyAccessRequired && !hasEarlyAccess) ||inProcess || noSmartLoan">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button"
            v-if="removeActionsConfig"
            :config="removeActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="(lpToken.earlyAccessRequired && !hasEarlyAccess)|| inProcess || noSmartLoan">
        </IconButtonMenuBeta>
        <IconButtonMenuBeta
            class="actions__icon-button"
            v-if="moreActionsConfig"
            :config="moreActionsConfig"
            v-on:iconButtonClick="actionClick"
            :disabled="(lpToken.earlyAccessRequired && !hasEarlyAccess) || inProcess || noSmartLoan || !healthLoaded">
        </IconButtonMenuBeta>
      </div>
    </div>

    <div class="chart-container" v-if="showLiquidityChart && chartData.length">
      <div class="chartjs-tooltip" :id="'chartjs-tooltip-' + index"></div>
      <SmallBlock v-on:close="toggleLiquidityChart()">
        <div class="small-block__content">
          <div class="legend">
            <div class="legend-item">
              <div class="circle circle--main"></div>
              <div class="legend-item__label">{{ lpToken.primary }}</div>
            </div>
            <div class="legend-item legend-item--secondary">
              <div class="circle circle--main"></div>
              <div class="legend-item__label">{{ lpToken.secondary }}</div>
            </div>
          </div>
          <LiquidityChart :tokens-data="chartData" :primary="lpToken.primary"
                          :secondary="lpToken.secondary" :index="index" :current-price-index="currentPriceIndex"
                          :current-price="currentPrice"></LiquidityChart>
        </div>
      </SmallBlock>
    </div>
  </div>
</template>

<script>
import DoubleAssetIcon from './DoubleAssetIcon.vue';
import IconButtonMenuBeta from './IconButtonMenuBeta.vue';
import config from '../config';
import {mapActions, mapState} from 'vuex';
import TraderJoeAddLiquidityModal from './TraderJoeAddLiquidityModal.vue';
import TraderJoeRemoveLiquidityModal from './TraderJoeRemoveLiquidityModal.vue';
import ClaimTraderJoeRewardsModal from "./ClaimTraderJoeRewardsModal.vue";
import {calculateMaxApy, formatUnits, getBinPrice, parseUnits} from '../utils/calculate';
import DeltaIcon from './DeltaIcon.vue';
import {ethers} from 'ethers';
import AddTraderJoeV2FromWalletModal from "./AddTraderJoeV2FromWalletModal.vue";
import WithdrawTraderJoeV2Modal from "./WithdrawTraderJoeV2Modal.vue";
import LiquidityChart from "./LiquidityChart.vue";
import FlatButton from "./FlatButton.vue";
import SmallBlock from "./SmallBlock.vue";
import LB_TOKEN from '/artifacts/contracts/interfaces/joe-v2/ILBToken.sol/ILBToken.json'
import {ActionSection} from "../services/globalActionsDisableService";
import { AssetsEntry, TokenType } from "../services/bullScoreService";

const toBytes32 = require('ethers').utils.formatBytes32String;

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'TraderJoeLpTableRow',
  components: {
    LiquidityChart,
    FlatButton,
    Chart,
    SmallBlock,
    DeltaIcon,
    DoubleAssetIcon,
    IconButtonMenuBeta
  },
  props: {
    lpToken: null,
    lpTokens: null,
    index: null,
  },

  async mounted() {
    this.chain = window.chain;
    if (this.lpToken.earlyAccessRequired) {
      this.sPrimeService.observeSPrimeValue().subscribe(value => {
        this.hasEarlyAccess = value >= this.lpToken.minSPrimeValue;
      });
    }

    this.setupAddActionsConfiguration();
    this.setupRemoveActionsConfiguration();
    this.setupMoreActionsConfiguration();
    this.watchRefreshLP();
    this.watchAssetBalancesDataRefreshEvent();
    this.watchHealth();
    this.watchAssetApysRefresh();
    this.watchHardRefreshScheduledEvent();
    this.watchAssetPricesUpdate();
    this.watchDebtsPerAssetDataRefreshEvent();
    this.watchLtipMaxBoostUpdate();
    this.initAccount();
    this.watchActionDisabling();
  },

  data() {
    return {
      chain: null,
      tokenX: null,
      tokenY: null,
      addActionsConfig: null,
      removeActionsConfig: null,
      moreActionsConfig: null,
      rowExpanded: false,
      showLiquidityChart: false,
      userBins: null,
      userBalances: null,
      apr: 0,
      tvl: 0,
      inProcess: false,
      healthLoaded: false,
      feesClaimable: 0,
      activeId: null,
      activePrice: null,
      hasBinsInPool: false,
      account: null,
      hasEarlyAccess: false,
      chartData: [],
      userValue: 0,
      currentPriceIndex: 0,
      currentPrice: 0,
      boostApy: 0,
      totalRewards: [],
      isActionDisabledRecord: {},
    };
  },

  computed: {
    ...mapState('network', ['provider']),
    ...mapState('fundsStore', [
      'assets',
      'health',
      'assetBalances',
      'assetAvailableBalances',
      'smartLoanContract',
      'readSmartLoanContract',
      'debtsPerAsset',
      'noSmartLoan'
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('poolStore', ['pools']),
    ...mapState('serviceRegistry', [
      'dataRefreshEventService',
      'progressBarService',
      'healthService',
      'lpService',
      'traderJoeService',
      'accountService',
      'priceService',
      'ltipService',
      'globalActionsDisableService',
      'sPrimeService',
      'bullScoreService',
    ]),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },

    maxApr() {
      return calculateMaxApy(this.pools, this.apr / 100);
    },

    firstAsset() {
      return config.ASSETS_CONFIG[this.lpToken.primary];
    },

    secondAsset() {
      return config.ASSETS_CONFIG[this.lpToken.secondary];
    }
  },

  methods: {
    ...mapActions('fundsStore', [
      'fundLiquidityTraderJoeV2Pool',
      'addLiquidityTraderJoeV2Pool',
      'withdrawLiquidityTraderJoeV2Pool',
      'removeLiquidityTraderJoeV2Pool',
      'claimTraderJoeRewards'
    ]),
    watchRefreshLP() {
      this.lpService.observeRefreshLp().subscribe(async (lpType) => {
        if (lpType !== 'TJV2') return;
        await this.setupPool();
        this.setupAddActionsConfiguration();
        this.setupRemoveActionsConfiguration();
        this.setupMoreActionsConfiguration();
        this.setupApr();
        this.calculateUserValue();
        this.calculateTotalRewards();
      })
    },
    setupAddActionsConfiguration(hasAccess) {
      this.addActionsConfig = {
        iconSrc: 'src/assets/icons/plus.svg',
        tooltip: 'Add',
        menuOptions: [
          {
            key: 'ADD_FROM_WALLET',
            name: 'Import existing LB position',
            disabled: this.isActionDisabledRecord['ADD_FROM_WALLET'],
          },
          {
            key: 'ADD_LIQUIDITY',
            name: 'Create LB position',
            disabled: this.isActionDisabledRecord['ADD_LIQUIDITY'] || !this.hasSmartLoanContract || this.inProcess,
            disabledInfo: this.isActionDisabledRecord['ADD_LIQUIDITY'] ? '' : 'To create LP token, you need to add some funds from you wallet first'
          },
        ]
      }
    },
    setupRemoveActionsConfiguration() {
      this.removeActionsConfig = {
        iconSrc: 'src/assets/icons/minus.svg',
        tooltip: 'Remove',
        menuOptions: [
          // {
          //   key: 'WITHDRAW',
          //   name: 'Export LB position',
          //   disabled: !this.hasSmartLoanContract || !this.hasBinsInPool,
          //   disabledInfo: 'No LB tokens in Prime Account'
          // },
          {
            key: 'REMOVE_LIQUIDITY',
            name: 'Remove LB position',
            disabled: this.isActionDisabledRecord['REMOVE_LIQUIDITY'] || !this.hasSmartLoanContract || this.inProcess || !this.hasBinsInPool,
            disabledInfo: this.isActionDisabledRecord['REMOVE_LIQUIDITY'] ? '' : 'No LB tokens in Prime Account'
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
            key: 'CLAIM_TRADERJOE_REWARDS',
            name: 'Claim TraderJoe rewards',
            disabled: this.isActionDisabledRecord['CLAIM_TRADERJOE_REWARDS'] || !this.hasSmartLoanContract || this.totalRewards.length == 0,
            disabledInfo: this.isActionDisabledRecord['CLAIM_TRADERJOE_REWARDS'] ? '' : 'You don\'t have any claimable rewards yet.'
          }
        ]
      };
    },

    initAccount() {
      this.accountService.observeAccountLoaded().subscribe(account => {
        this.account = account;
        this.getUserBinsAndBalances();
      });

      this.accountService.observeSmartLoanContract().subscribe(() => {
        this.setupAddActionsConfiguration();
        this.setupRemoveActionsConfiguration();
        this.setupMoreActionsConfiguration();
      })
    },

    async getUserBinsAndBalances() {
      let result = await fetch(`${config.geolocationServiceUrl}/api/tjv2-bins?account=${this.account}&chainSlug=${config.chainSlug}&address=${this.lpToken.address}`);

      this.userBins = (await result.json()).result;
      let readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
      const lbToken = new ethers.Contract(this.lpToken.address, LB_TOKEN.abi, readProvider);

      this.userBalances = [];
      await Promise.all(
        this.userBins.map(async (id, i) => {
          return lbToken.balanceOf(this.account, id).then(
              res => {
                this.userBalances[i] = res;
              }
          )
        })
      );
    },

    calculateUserValue() {
      this.userValue = this.lpToken.primaryBalance * this.firstAsset.price + this.lpToken.secondaryBalance * this.secondAsset.price;
      this.bullScoreService.setToken(TokenType.TJV2, new AssetsEntry(
        this.lpToken.symbol,
        0.5,
        { symbol: this.lpToken.primary, value: this.lpToken.primaryBalance * this.firstAsset.price },
        { symbol: this.lpToken.secondary, value: this.lpToken.secondaryBalance * this.secondAsset.price }
        )
      )
    },

    setupButtonConfigs(hasAccess) {
      this.setupAddActionsConfiguration(hasAccess);
      this.setupRemoveActionsConfiguration(hasAccess);
      this.setupMoreActionsConfiguration(hasAccess);
    },

    async calculateTotalRewards() {
      let totalRewards = [];
      const rewardTokens = {};

      let addresses = (await import(`/common/addresses/${window.chain}/token_addresses.json`)).default;

      if (this.lpToken.rewardsInfo) {

        this.lpToken.rewardsInfo.rewards.forEach(reward => {
          const tokenAddress = reward.tokenAddress.toLowerCase();

          if (!(tokenAddress in rewardTokens)) {
            let symbol;

            for (const [asset, address] of Object.entries(addresses)) {
              if (address.toLowerCase() === tokenAddress) symbol = asset;
            }

            rewardTokens[tokenAddress] = {
              symbol,
              address: tokenAddress,
              decimals: config.ASSETS_CONFIG[symbol].decimals
            }
          }
        });
      }

      Object.values(rewardTokens).map(token => {
        let rewardToken = 0;

        if (this.lpToken.rewardsInfo) {
          rewardToken = this.lpToken.rewardsInfo.rewards
            .filter(rewardToken => rewardToken.tokenAddress.toLowerCase() === token.address.toLowerCase())
            .reduce((sum, rewardToken) => sum + parseFloat(formatUnits(rewardToken.amount, token.decimals)), 0);
        }

        totalRewards.push({
          symbol: token.symbol,
          amount: rewardToken.toFixed(6)
        });
      });

      this.totalRewards = totalRewards;
    },

    actionClick(key) {
      if (!this.isActionDisabledRecord[key] && !this.inProcess) {
        switch (key) {
          case 'ADD_FROM_WALLET':
            this.openAddTraderJoeV2FromWalletModal();
            break;
          case 'WITHDRAW':
            this.openWithdrawTraderJoeV2Modal();
            break;
          case 'ADD_LIQUIDITY':
            this.openAddLiquidityModal();
            break;
          case 'REMOVE_LIQUIDITY':
            this.openRemoveLiquidityModal();
            break;
          case 'CLAIM_TRADERJOE_REWARDS':
            this.openClaimRewardsModal();
        }
      }
    },

    async openAddTraderJoeV2FromWalletModal() {
      const modalInstance = this.openModal(AddTraderJoeV2FromWalletModal);
      modalInstance.userBins = this.userBins;
      modalInstance.userBalances = this.userBalances;
      modalInstance.lpToken = this.lpToken;
      modalInstance.lpTokens = this.lpTokens;

      modalInstance.$on('ADD_FROM_WALLET', addFromWalletEvent => {
        const fundLiquidityRequest = {
          ids: this.userBins,
          amounts: this.userBalances,
          pair: this.lpToken.address,
          firstAsset: this.lpToken.primary,
          secondAsset: this.lpToken.secondary,
          lpToken: this.lpToken
        };

        this.handleTransaction(this.fundLiquidityTraderJoeV2Pool, {fundLiquidityRequest: fundLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
          this.closeTraderJoeLpModal();
        });
      });
    },

    async openWithdrawTraderJoeV2Modal() {
      const modalInstance = this.openModal(WithdrawTraderJoeV2Modal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.canRepayAllDebts = this.canRepayAllDebts;

      modalInstance.$on('WITHDRAW', addFromWalletEvent => {
        const withdrawLiquidityRequest = {
          ids: this.lpToken.binIds,
          amounts: this.lpToken.accountBalances.map(el => el.toLocaleString('fullwide', {useGrouping: false})),
          pair: this.lpToken.address,
          lpToken: this.lpToken
        };

        this.handleTransaction(this.withdrawLiquidityTraderJoeV2Pool, {withdrawLiquidityRequest: withdrawLiquidityRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
          this.closeTraderJoeLpModal();
        });
      });
    },

    openAddLiquidityModal() {
      const modalInstance = this.openModal(TraderJoeAddLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.firstAsset = this.firstAsset;
      modalInstance.secondAsset = this.secondAsset;
      modalInstance.firstAssetBalance = this.assetAvailableBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetAvailableBalances[this.lpToken.secondary];
      modalInstance.activeId = this.activeId;
      modalInstance.activePrice = this.activePrice;
      modalInstance.binStep = this.lpToken.binStep;
      modalInstance.lpTokens = this.lpTokens;
      modalInstance.readSmartLoanContract = this.readSmartLoanContract;
      modalInstance.traderJoeService = this.traderJoeService;
      modalInstance.addLiquidityParams = {
        account: this.account,
        tokenX: this.tokenX,
        tokenY: this.tokenY,
      }
      modalInstance.$on('ADD_LIQUIDITY', async addLiquidityEvent => {
        if (this.smartLoanContract) {
          const addLiquidityRequest = {
            symbol: this.lpToken.symbol,
            method: this.lpToken.addMethod,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            firstAmount: addLiquidityEvent.firstAssetAmount,
            secondAmount: addLiquidityEvent.secondAssetAmount,
            addLiquidityInput: addLiquidityEvent.addLiquidityInput,
            routerAddress: this.lpToken.routerAddress
          };

          this.handleTransaction(this.addLiquidityTraderJoeV2Pool, {addLiquidityRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
            if (!addLiquidityEvent.batchTransfer) {
              this.closeTraderJoeLpModal();
            }
          });
        }
      });
    },

    openRemoveLiquidityModal() {
      const modalInstance = this.openModal(TraderJoeRemoveLiquidityModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.firstAsset = this.firstAsset;
      modalInstance.secondAsset = this.secondAsset;
      modalInstance.firstAssetBalance = this.assetBalances[this.lpToken.primary];
      modalInstance.secondAssetBalance = this.assetBalances[this.lpToken.secondary];
      modalInstance.activeId = this.activeId;
      modalInstance.binStep = this.lpToken.binStep;
      modalInstance.binIds = this.lpToken.binIds;
      console.log(this.lpToken.binIds);
      modalInstance.$on('REMOVE_LIQUIDITY', async removeLiquidityEvent => {
        if (this.smartLoanContract) {
          const removeLiquidityInput = await this.traderJoeService.getRemoveLiquidityParameters(
              this.smartLoanContract.address,
              this.lpToken.address,
              this.provider,
              this.tokenX,
              this.tokenY,
              this.lpToken.binStep,
              removeLiquidityEvent.allowedAmountsSlippage * 100,
              removeLiquidityEvent.binIdsToRemove
          );
          const removeLiquidityRequest = {
            symbol: this.lpToken.symbol,
            lbPairAddress: this.lpToken.address,
            method: this.lpToken.removeMethod,
            firstAsset: this.lpToken.primary,
            secondAsset: this.lpToken.secondary,
            remainingBinIds: removeLiquidityEvent.remainingBinIds,
            removeLiquidityInput,
            lpToken: this.lpToken,
            routerAddress: this.lpToken.routerAddress,
            forceTransaction: removeLiquidityEvent.forceTransaction
          };

          this.handleTransaction(this.removeLiquidityTraderJoeV2Pool, {removeLiquidityRequest}, () => {
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
            this.closeTraderJoeLpModal();
          });
        }
      });
    },

    async openClaimRewardsModal() {
      const modalInstance = this.openModal(ClaimTraderJoeRewardsModal);
      modalInstance.lpToken = this.lpToken;
      modalInstance.totalRewards = this.totalRewards;

      const merkleEntries = [];

      if (this.lpToken.rewardsInfo && this.lpToken.version !== '2.2') {
        this.lpToken.rewardsInfo.rewards.map((reward, id) => {
          merkleEntries.push({
            market: this.lpToken.address,
            epoch: reward.epoch,
            token: reward.tokenAddress,
            user: this.smartLoanContract.address,
            amount: reward.totalAmount,
            merkleProof: this.lpToken.rewardsInfo.proofs[id]
          });
        });
      }

      const claimRewardsRequest =
          this.lpToken.version === '2.2'
              ?
              {
                version: this.lpToken.version,
                pair: this.lpToken.address,
                ids: this.lpToken.binIds
              }
              :
              {
                version: this.lpToken.version,
                merkleEntries: merkleEntries
              };

      modalInstance.$on('CLAIM', addFromWalletEvent => {
        if (this.smartLoanContract) {
          this.handleTransaction(this.claimTraderJoeRewards, { claimRewardsRequest: claimRewardsRequest }, () => {
            this.rewards = 0;
            this.$forceUpdate();
          }, (error) => {
            this.handleTransactionError(error);
          }).then(() => {
          });
        }
      });
    },

    closeTraderJoeLpModal() {
      this.closeModal();
      setTimeout(() => {
        this.calculateChartData();
      })
    },

    watchAssetBalancesDataRefreshEvent() {
      this.dataRefreshEventService.assetBalancesDataRefreshEvent$.subscribe(() => {
        this.inProcess = false;
        this.calculateUserValue();
        this.$forceUpdate();
      });
    },

    watchHardRefreshScheduledEvent() {
      this.dataRefreshEventService.hardRefreshScheduledEvent$.subscribe(() => {
        this.inProcess = true;
        this.$forceUpdate();
      });
    },

    watchHealth() {
      this.healthService.observeHealth().subscribe(health => {
        this.healthLoaded = true;
      });
    },

    watchAssetApysRefresh() {
      this.dataRefreshEventService.observeAssetApysDataRefresh().subscribe(() => {
        this.setupApr();
      })
    },

    watchAssetPricesUpdate() {
      this.priceService.observeRefreshPrices().subscribe((updateEvent) => {
        this.calculateUserValue();
      });
    },

    watchDebtsPerAssetDataRefreshEvent() {
      this.dataRefreshEventService.debtsPerAssetDataRefreshEvent$.subscribe(() => {
        this.canRepayAllDebts = Object.values(this.debtsPerAsset).every(
            debt => {
              let balance = parseFloat(this.assetBalances[debt.asset]);

              return parseFloat(debt.debt) <= balance;
            }
        );
        this.$forceUpdate();
      });
    },

    watchLtipMaxBoostUpdate() {
      this.ltipService.observeLtipMaxBoostApy().subscribe((boostApy) => {
        this.boostApy = boostApy;
      });
    },

    async setupPool() {
      const tokenX = this.traderJoeService.initializeToken(this.firstAsset);
      const tokenY = this.traderJoeService.initializeToken(this.secondAsset);

      this.tokenX = tokenX;
      this.tokenY = tokenY;

      const [reserves, activeId] = await this
          .traderJoeService
          .getLBPairReservesAndActiveBin(this.lpToken.address, this.provider);

      const tokenXTVL = formatUnits(reserves[0], this.firstAsset.decimals) * this.firstAsset.price;
      const tokenYTVL = formatUnits(reserves[1], this.secondAsset.decimals) * this.secondAsset.price;

      this.lpToken.tvl = tokenXTVL + tokenYTVL;
      this.activeId = activeId;
      this.activePrice = getBinPrice(activeId, this.lpToken.binStep, this.firstAsset.decimals, this.secondAsset.decimals);
      this.hasBinsInPool = this.lpToken.binIds && this.lpToken.binIds.length > 0;
    },

    setupApr() {
      if (!this.lpToken.apy) return;
      this.apr = this.lpToken.apy;
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
      this.closeTraderJoeLpModal();
      this.inProcess = false;
      this.isBalanceEstimated = false;
    },

    toggleLiquidityChart() {
      if (this.rowExpanded) {
        this.chartData = []
        this.showLiquidityChart = false;
        this.rowExpanded = false;
      } else {
        this.calculateChartData()
        this.rowExpanded = true;
        setTimeout(() => {
          this.showLiquidityChart = true;
        }, 200);
      }
    },
    calculateChartData() {
      if (this.lpToken.binIds) {
        const newChartData = []
        let index = 0
        let indexBin = this.lpToken.binIds[index]
        this.currentPriceIndex = -1
        while (indexBin <= this.lpToken.binIds[this.lpToken.binIds.length - 1]) {
          if (indexBin === this.activeId) {
            this.currentPriceIndex = newChartData.length
          }
          if (this.lpToken.binIds.findIndex(binId => binId === indexBin) > -1) {
            newChartData.push({
              isPrimary: this.lpToken.accountBalancesPrimary[index] > this.lpToken.accountBalancesSecondary[index],
              primaryTokenBalance: this.lpToken.accountBalancesPrimary[index],
              secondaryTokenBalance: this.lpToken.accountBalancesSecondary[index],
              price: this.getPriceOfBin(indexBin),
              value: this.lpToken.accountBalancesPrimary[index] * this.firstAsset.price + this.lpToken.accountBalancesSecondary[index] * this.secondAsset.price
            })
            index++;
          } else {
            newChartData.push({
              isEmpty: true,
              isPrimary: false,
              primaryTokenBalance: 0,
              secondaryTokenBalance: 0,
              price: this.getPriceOfBin(indexBin),
              value: newChartData[newChartData.length - 1] ? newChartData[newChartData.length - 1].value : newChartData.find(data => data.value > 0).value,
            })
          }
          indexBin++;
        }
        this.chartData = newChartData
        this.currentPrice = this.getPriceOfBin(this.activeId)
      }
    },
    getPriceOfBin(binId) {
      return ((1 + this.lpToken.binStep / 10000) ** (binId - 8388608) * 10 ** (this.firstAsset.decimals - this.secondAsset.decimals))
    },

    watchActionDisabling() {
      this.globalActionsDisableService.getSectionActions$(ActionSection.TRADER_JOE_LP)
          .subscribe(isActionDisabledRecord => {
            this.isActionDisabledRecord = isActionDisabledRecord;
            this.setupAddActionsConfiguration();
            this.setupRemoveActionsConfiguration();
            this.setupMoreActionsConfiguration();
          })
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.traderJoe-lp-table-row-component {
  height: 60px;
  transition: all 200ms;
  border-style: solid;
  border-width: 0 0 2px 0;
  border-image-source: var(--asset-table-row__border);
  border-image-slice: 1;

  &.expanded {
    height: 404px;
  }

  .table__row {
    display: grid;
    grid-template-columns: 200px 90px 90px 210px 110px 70px 110px 115px 30px 80px;
    height: 60px;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

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
          text-align: right;
        }
      }

      &.table__cell--rewards-token {
        flex-direction: column;
        justify-content: center;

        .more-rewards {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__double-value-color);
          font-weight: 500;
          text-align: right;
        }
      }

      .sprime-early-access {
        width: 50px;

        img, .early-access-placeholder {
          margin-left: 5px;
          display: inline-block;
        }
      }

      &.asset {
        align-items: center;
        justify-content: space-between;

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
          width: 150px;
        }

        .asset__name {
          color: var(--default-text-color);
        }

        .asset__dex {
          font-size: $font-size-xxs;
          color: var(--asset-table-row__asset-loan-color);
        }
      }

      &.fees {
        align-items: flex-end;
      }

      &.liquidity {
        align-items: center;
        justify-content: end;

        .active-indicator {
          margin-right: 5px;

          img {
            transform: translateY(-1px);
          }
        }

        .flat-button-component {
          margin: 0;
        }
      }

      &.composition {
        display: flex;
        align-items: center;
        justify-content: flex-end;

        img {
          margin-left: 5px;
        }
      }

      &.farmed {
        align-items: flex-end;
      }

      &.loan, &.apr, &.max-apr {
        align-items: flex-end;
      }

      &.apr {
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;

        .apr-warning {
          margin-right: 5px;
        }
      }

      &.rewards {
        align-items: center;
        justify-content: flex-end;
      }

      &.max-apr {
        font-weight: 600;
        flex-direction: row;
        align-items: center;
        justify-content: end;

        .stars-icon {
          width: 20px;
          margin-left: 2px;
          transform: translateY(-2px);
        }
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
      }

      .action-button {
        cursor: pointer;
        background: var(--icon-button-menu-beta__icon-color--default);

        &:not(:last-child) {
          margin-right: 12px;
        }

        &:hover {
          background: var(--icon-button-menu-beta__icon-color-hover--default);
        }

        &.action-button--disabled {
          background: var(--icon-button-menu-beta__icon-color--disabled);
          cursor: default;
          pointer-events: none;
        }
      }

      .no-value-dash {
        height: 1px;
        width: 15px;
        background-color: var(--asset-table-row__no-value-dash-color);
      }
    }
  }

  .asset__icon {
    height: 22px;
    width: 22px;
    border-radius: 50%;
    margin-right: 9px;
  }

  .bin-step {
    display: flex;
    flex-direction: row;
    justify-content: center;
    flex-wrap: nowrap;
    align-items: center;
    padding: 0 4px;
    width: 30px;
    height: 20px;
    margin-left: 5px;
    border-radius: 6px;
    border: solid 1px var(--flat-button__border-color);
    text-transform: uppercase;
    font-size: $font-size-xs;
    color: var(--flat-button__color);
    font-weight: bold;
  }

  .chart-container {
    display: flex;
    position: relative;
    margin: 2rem 0;
    height: 256px;
    width: 100%;

    .small-block__content {
      height: calc(100% - 22px);
    }

    div {
      width: 100%;
      height: 100%;
    }
  }

  .legend {
    position: absolute;
    top: 20px;
    right: 70px;
    display: flex;
    flex-direction: row;
    gap: 16px;
    height: unset !important;
    width: unset !important;

    .legend-item {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 3px;

      .circle {
        flex-shrink: 0;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--liquidity-chart__main-token-color);
      }

      &.legend-item--secondary .circle {
        background: var(--liquidity-chart__secondary-token-color) !important;
      }

      .legend-item__label {
        font-size: 12px;
        font-weight: 500;
        color: var(--liquidity-chart__axis-label-color);
      }
    }
  }
}

</style>

<style>
.chartjs-tooltip {
  width: unset !important;
  height: unset !important;
  position: absolute;
  pointer-events: none;
  opacity: 0;
  background: var(--liquidity-chart__tooltip-background-color);
  box-shadow: var(--liquidity-chart__tooltip-box-shadow);
  color: var(--liquidity-chart__tooltip-color);
  padding: 6px 10px 8px 10px;
  font-size: 12px;
  border-radius: 6px;
  z-index: 999;

  .value {
    font-weight: 600;
  }
}
</style>
