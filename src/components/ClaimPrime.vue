<template>
  <div class="claim-page">
    <div class="claim-page__content">
      <img class="claim-page__logo" src="src/assets/logo/claim-logo.svg" alt="">
      <div class="claim-page__label">
        {{ description }}
      </div>
      <div class="claim-page__amount-text">
        <div v-if="chain === 'avalanche'">
          Claimable amount: <span class="claim-page__amount">{{ claimableAmount }}</span>
        </div>
      </div>
      <div class="claim-page__button" v-if="claimableAmount && claimableAmount > 0 && chain === 'avalanche'">
        <BorderedButton :action="onClick"><span class="claim-page__button-text">Claim</span></BorderedButton>
      </div>
    </div>
  </div>
</template>

<script>
import VESTING_CONTRACT
  from '../abis/IPrimeVesting.json';

import BorderedButton from './BorderedButton.vue';
import config from '../config';
import {mapActions, mapState} from 'vuex';

const ethers = require('ethers');
import {fromWei} from '../utils/calculate';

export default {
  name: 'ClaimPrime',
  components: {BorderedButton},
  async mounted() {
    this.initNetwork();
    this.accountService.observeAccountLoaded().subscribe(() => {
      this.chain = window.chain;
      this.fetchClaimable();
    });
  },
  computed: {
    ...mapState('network', ['provider', 'account']),
    ...mapState('serviceRegistry', ['providerService', 'accountService']),
    description() {
      if (!window.chain) {
        return ''
      }
      if (window.chain === 'avalanche') {
        return 'Here you can claim your PRIME'
      }
      if (window.chain !== 'avalanche') {
        return 'Claiming available only on Avalanche'
      }
    }
  },


  data() {
    return {
      claimableAmount: 0,
      vestingContract: null,
      chain: null
    };
  },
  methods: {
    ...mapActions('network', ['initNetwork']),
    async onClick() {
      if (chain === 'avalanche' && this.vestingContract && this.claimableAmount) {
        await this.vestingContract.claim();
      }
    },
    async fetchClaimable() {
      if (chain === 'avalanche') {
        this.vestingContract = new ethers.Contract(config.VESTING_CONTRACT_CONFIG.address, VESTING_CONTRACT.abi, this.provider.getSigner());

        this.claimableAmount = fromWei(await this.vestingContract.claimable(this.account))
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.claim-page {
  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 500px;
    padding: 40px 50px 50px 50px;
    background: var(--claim-page__content-background);
    box-shadow: var(--claim-page__content-box-shadow);
    border-radius: 35px;
    margin: 100px auto 0 auto;
  }

  &__logo {
    height: 150px;
    width: 150px;
    filter: var(--claim-page__logo-box-shadow);
    margin-bottom: 40px;
  }

  &__label {
    color: var(--claim-page__label-color);
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 6px;
  }

  &__amount-text {
    font-size: 21px;
    font-weight: 500;
    color: var(--claim-page__amount-text-color);
    margin-bottom: 40px;
  }

  &__amount {
    font-weight: bold;
  }

  &__button-text {
    font-size: 20px;
    line-height: 24px;
    letter-spacing: 1px;
    color: #fff;
    font-weight: 800;
    text-transform: uppercase;
  }

  .claim-page__label {
    margin-bottom: 20px;
  }

  .claim-page__button {
    cursor: pointer;

    &.disabled {
      opacity: 30%;
      cursor: initial;
    }
  }
}
</style>
