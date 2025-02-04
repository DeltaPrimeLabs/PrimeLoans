<template>
  <ZapTile v-on:tileClick="onTileClick()" :disabled="disabled || !hasSmartLoanContract"
           :img-src="'src/assets/icons/chart-down.png'" :dark-img-src="'src/assets/icons/chart-down--dark.png'"
           :header="'Short'">
    <template #label>
      up to <b>5x</b>
    </template>
    <template #default>
      <div class="icons">
        <img class="icon" v-for="icon in tokenIcons" :src="icon">
      </div>
    </template>
  </ZapTile>
</template>

<script>
import {mapActions, mapState} from 'vuex';
import config from '../../config';
import erc20ABI from '../../abis/ERC20.json';
import {combineLatest} from 'rxjs';
import YAK_ROUTER_ABI from '../../abis/YakRouter.json';
import {parseUnits} from '../../utils/calculate';
import {BigNumber} from 'ethers';
import ZapShortModal from '../zaps-modals/ZapShortModal.vue';
import ZapTile from './ZapTile.vue';

const ethers = require('ethers');

let TOKEN_ADDRESSES;

//TODO: make common logic to check if user has a smart account
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'ZapShort',
  components: {ZapTile},
  props: {
    disabled: null,
  },
  data() {
    return {
      tokenIcons: []
    };
  },

  computed: {
    ...mapState('fundsStore', [
      'smartLoanContract',
      'health',
      'assetBalances',
      'debtsPerAsset',
      'assets',
      'lpAssets',
      'concentratedLpAssets',
      'traderJoeV2LpAssets',
      'lpBalances',
      'concentratedLpBalances',
      'levelLpAssets',
      'levelLpBalances',
      'balancerLpAssets',
      'balancerLpBalances',
      'penpieLpBalances',
      'penpieLpAssets',
      'wombatLpBalances',
      'wombatLpAssets',
      'wombatYYFarmsBalances',
      'fullLoanStatus'
    ]),
    ...mapState('stakeStore', ['farms']),
    ...mapState('network', ['provider', 'account', 'accountBalance']),
    ...mapState('serviceRegistry', [
      'progressBarService'
    ]),

    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },
  },

  async mounted() {
    await this.setupFiles();
    this.setupLogos();
  },

  methods: {
    ...mapActions('fundsStore',
      [
        'swap',
        'fund',
        'borrow',
      ]),

    async setupFiles() {
      TOKEN_ADDRESSES = await import(`/common/addresses/${window.chain}/token_addresses.json`);
    },

    setupLogos() {
      this.tokenIcons = Object.values(config.ASSETS_CONFIG).filter(asset => !asset.isStableCoin && config.POOLS_CONFIG[asset.symbol] && !config.POOLS_CONFIG[asset.symbol].disabled).map(asset => this.logoSrc(asset.symbol)).slice(0, 6)
    },

    async onTileClick() {
      if (!this.hasSmartLoanContract) return;
      if (this.disabled) {
        return;
      }
      const stableCoins = Object.values(config.ASSETS_CONFIG).filter(asset => asset.isStableCoin).map(asset => asset.symbol);
      const stableCoinsWalletBalances = {};
      this.getStableCoinsWalletBalances(stableCoins).subscribe(balances => {
        stableCoins.forEach((coin, index) => {
          stableCoinsWalletBalances[coin] = balances[index];
        });
        const modalInstance = this.openModal(ZapShortModal);

        modalInstance.assets = this.assets;
        modalInstance.assetBalances = this.assetBalances;
        modalInstance.lpAssets = this.lpAssets;
        modalInstance.concentratedLpAssets = this.concentratedLpAssets;
        modalInstance.lpBalances = this.lpBalances;
        modalInstance.concentratedLpBalances = this.concentratedLpBalances;
        modalInstance.traderJoeV2LpAssets = this.traderJoeV2LpAssets;
        modalInstance.balancerLpBalances = this.balancerLpBalances;
        modalInstance.balancerLpAssets = this.balancerLpAssets;
        modalInstance.penpieLpAssets = this.penpieLpAssets;
        modalInstance.penpieLpBalances = this.penpieLpBalances;
        modalInstance.wombatLpAssets = this.wombatLpAssets;
        modalInstance.wombatLpBalances = this.wombatLpBalances;
        modalInstance.wombatYYFarmsBalances = this.wombatYYFarmsBalances;
        modalInstance.farms = this.farms;
        modalInstance.debtsPerAsset = this.debtsPerAsset;
        modalInstance.debt = this.fullLoanStatus.debt;
        modalInstance.thresholdWeightedValue = this.fullLoanStatus.thresholdWeightedValue;

        modalInstance.stableCoinsWalletBalances = stableCoinsWalletBalances;
        modalInstance.accountAssetBalances = this.assetBalances;

        this.$forceUpdate();

        modalInstance.$on('ZAP_SHORT_EVENT', async zapShortEvent => {
          const shortAssetDecimals = config.ASSETS_CONFIG[zapShortEvent.shortAsset].decimals;
          const stableCoinDecimals = config.ASSETS_CONFIG[zapShortEvent.stableCoin].decimals;

          const borrowRequest = {
            asset: zapShortEvent.shortAsset,
            amount: zapShortEvent.shortAssetAmount,
            keepModalOpen: true
          };
          const shortAssetAmountInWei = parseUnits(Number(zapShortEvent.shortAssetAmount).toFixed(shortAssetDecimals), BigNumber.from(shortAssetDecimals));
          const swapQueryResponse = await this.yakSwapQueryMethod()(zapShortEvent.shortAsset, zapShortEvent.stableCoin, shortAssetAmountInWei);

          const swapRequest = {
            sourceAsset: zapShortEvent.shortAsset,
            targetAsset: zapShortEvent.stableCoin,
            sourceAmount: zapShortEvent.shortAssetAmount,
            targetAmount: zapShortEvent.stableCoinAmount,
            path: swapQueryResponse.path,
            adapters: swapQueryResponse.adapters,
            swapDex: 'YakSwap'
          };

          await this.handleTransaction(this.borrow, {borrowRequest: borrowRequest}, async () => {
            await this.handleTransaction(this.swap, {swapRequest: swapRequest}, () => {
            }, (error) => {
              this.handleTransactionError(error);
            });
          }, (error) => {
            this.handleTransactionError(error);
          });
        });
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
      this.inProcess = false;
    },


    //TODO: remove
    getStableCoinsWalletBalances(stableCoins) {
      return combineLatest(
        stableCoins.map(stableCoin => {
            const contract = new ethers.Contract(config.ASSETS_CONFIG[stableCoin].address, erc20ABI, this.provider.getSigner());
            return this.getWalletTokenBalance(
              this.account,
              stableCoin,
              contract,
              config.ASSETS_CONFIG[stableCoin].decimals
            );
          }
        )
      );
    },

    yakSwapQueryMethod() {
      return async (sourceAsset, targetAsset, amountIn) => {

        const tknFrom = config.ASSETS_CONFIG[sourceAsset].address;
        const tknTo = config.ASSETS_CONFIG[targetAsset].address;

        const readProvider = new ethers.providers.JsonRpcProvider(config.readRpcUrl);
        const yakRouter = new ethers.Contract(config.yakRouterAddress, YAK_ROUTER_ABI, readProvider);

        const maxHops = 3;
        const gasPrice = ethers.utils.parseUnits('0.2', 'gwei');

        try {
          return {
            ...(await yakRouter.findBestPathWithGas(
              amountIn,
              tknFrom,
              tknTo,
              maxHops,
              gasPrice,
              {gasLimit: 1e9}
            )),
            dex: 'YAK_SWAP'
          }
        } catch (e) {
          console.error(e);
        }
      };
    },
  }
};
</script>

<style lang="scss" scoped>
.icons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  grid-column-gap: 12px;
  grid-row-gap: 12px;
  width: 102px;
  height: 64px;
  margin-bottom: 32px;
  user-select: none;
}

.icon {
  height: 100%;
}
</style>
