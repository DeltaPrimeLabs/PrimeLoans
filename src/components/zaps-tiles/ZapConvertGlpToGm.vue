<template>
  <ZapTile v-on:tileClick="onTileClick()"
           :disabled="disabled || !hasSmartLoanContract"
           :img-src="'src/assets/icons/glp_to_gm_zap_icon.png'"
           :dark-img-src="'src/assets/icons/glp_to_gm_zap_icon--dark.png'"
           :img-class="'glp-to-gm-img'"
           :header="'Convert GLP to GM'">
    <template #label>
      <b>Utility</b>
    </template>
    <template #default>
    </template>
  </ZapTile>
</template>

<script>
import {mapActions, mapState} from 'vuex';
import config from '../../config';
import erc20ABI from '../../abis/ERC20.json';
import ZapTile from './ZapTile.vue';
import ConvertGlpToGmModal from '../ConvertGlpToGmModal.vue';
import {calculateGmxV2ExecutionFee} from '../../utils/blockchain';

const ethers = require('ethers');

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

export default {
  name: 'ZapConvertGlpToGm',
  components: {ZapTile},
  props: {
    disabled: null,
  },
  data() {
    return {};
  },

  computed: {
    ...mapState('fundsStore', [
      'smartLoanContract',
      'assetBalances',
      'assets',

    ]),
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', [
      'progressBarService'
    ]),
    hasSmartLoanContract() {
      return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
    },
  },

  async mounted() {
  },

  methods: {
    ...mapActions('fundsStore',
      [
        'fund',
        'convertGlpToGm',
      ]),


    async onTileClick() {
      if (!this.hasSmartLoanContract) return;
      if (this.disabled) {
        return;
      }

      const modalInstance = this.openModal(ConvertGlpToGmModal);
      const tokenContract = new ethers.Contract(this.assets['GLP'].address, erc20ABI, this.provider.getSigner());

      modalInstance.walletGlpBalance = await this.getWalletTokenBalance(this.account, 'GLP', tokenContract, this.assets['GLP'].decimals);
      modalInstance.smartLoanGlpBalance = this.assetBalances['GLP'];
      modalInstance.gmOptions = Object.values(config.GMX_V2_ASSETS_CONFIG);

      this.$forceUpdate();

      //TODO: display and validate fee in the modal
      const executionFee = await calculateGmxV2ExecutionFee(
        config.gmxV2DataStoreAddress,
        config.gmxV2DepositCallbackGasLimit,
        config.gmxV2UseMaxPriorityFeePerGas,
        config.gmxV2GasPriceBuffer,
        config.gmxV2GasPricePremium,
        true);

      modalInstance.$on('ZAP_CONVERT_GLP_TO_GM_EVENT', async convertEvent => {
        const convertRequest = {
          targetMarketSymbol: convertEvent.targetMarketSymbol,
          executionFee: executionFee
        };
        console.log('convert to gm request');
        console.log(convertRequest);
        this.handleTransaction(this.convertGlpToGm, {convertRequest: convertRequest}, () => {
          this.$forceUpdate();
        }, (error) => {
          this.handleTransactionError(error);
        }).then(() => {
        });
      });
    },
  }
};
</script>

<style lang="scss" scoped>
</style>
