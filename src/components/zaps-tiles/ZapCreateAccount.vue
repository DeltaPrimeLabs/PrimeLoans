<template>
  <ZapTile v-on:tileClick="onTileClick()"
           :disabled="disabled"
           :img-src="'src/assets/icons/zap-create-account--light.svg'"
           :dark-img-src="'src/assets/icons/zap-create-account--dark.svg'"
           :header="'Create a new Prime Account'"
           :img-class="'create-account-zap-img'"
           :tile-class="'create-account-zap-tile'">
    <template #label>
      Start <b>here</b>
    </template>
    <template #default>
    </template>
  </ZapTile>
</template>

<script>
import {mapActions, mapState} from 'vuex';
import config from '../../config';
import erc20ABI from '../../../test/abis/ERC20.json';
import {combineLatest, combineLatestWith, from, map} from 'rxjs';
import ZapTile from "./ZapTile.vue";
import CreateAccountModal from "../CreateAccountModal.vue";

const ethers = require('ethers');


export default {
  name: 'ZapCreateAccount',
  components: {ZapTile},
  props: {
    disabled: null,
  },
  data() {
    return {};
  },

  computed: {
    ...mapState('fundsStore', []),
    ...mapState('network', ['provider', 'account', 'accountBalance']),
    ...mapState('serviceRegistry', [
      'progressBarService'
    ]),
  },

  async mounted() {
  },

  methods: {
    ...mapActions('fundsStore',
        [
          'swap',
          'fund',
          'borrow',
          'createAndFundLoan',
        ]),
    ...mapActions('network', ['updateBalance']),

    async onTileClick() {
      if (this.disabled) {
        return;
      }
      const modalInstance = this.openModal(CreateAccountModal);

      this.getWalletBalances().subscribe(balances => {
        modalInstance.setTokenBalances(balances)
      })
      modalInstance.assets = Object.keys(config.ASSETS_CONFIG).filter(el => !el.inactive);
      modalInstance.selectedAsset = config.ASSETS_CONFIG[config.nativeToken];

      this.$forceUpdate();

      modalInstance.$on('ZAP_CREATE_ACCOUNT_EVENT', async createAccountEvent => {
        const fundRequest = {
          value: createAccountEvent.value,
          asset: createAccountEvent.asset,
          isLP: false,
        };
        this.handleTransaction(this.createAndFundLoan, fundRequest, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
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
    },

    getWalletBalances() {
      const tokens = Object.values(config.ASSETS_CONFIG).map(asset => asset.symbol);

      return combineLatest(tokens.map(token => {
            const contract = new ethers.Contract(config.ASSETS_CONFIG[token].address, erc20ABI, this.provider.getSigner());
            return this.getWalletTokenBalance(
                this.account,
                token,
                contract,
                config.ASSETS_CONFIG[token].decimals
            );
          }
      )).pipe(combineLatestWith(from(this.updateBalance()).pipe(map(() => this.accountBalance))))
          .pipe(map(([balances, nativeTokenBalance]) => {
                const balancesObject = balances.reduce((acc, current, index) => {
                  const tokenSymbol = tokens[index]
                  if (tokenSymbol === config.NATIVE_ASSET_TOGGLE_OPTIONS[0]) {
                    acc[config.NATIVE_ASSET_TOGGLE_OPTIONS[1]] = current
                  } else {
                    acc[tokenSymbol] = current
                  }
                  return acc
                }, {})
                balancesObject[config.NATIVE_ASSET_TOGGLE_OPTIONS[0]] = nativeTokenBalance
                return balancesObject
              }
          ))
    },
  }
};
</script>

<style scoped>

</style>
