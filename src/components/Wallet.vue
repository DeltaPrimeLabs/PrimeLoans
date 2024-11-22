<template>
  <div class="wallet">
    <img class="logo" src="src/assets/icons/avax-icon.svg"/>
    <div class="network">{{network}}</div>
    <div class="prime-account" v-if="hasSmartLoanContract">
      <div class="separator"></div>
      <img class="logo" src="src/assets/logo/deltaprime.svg"/>
      <div class="account"  v-tooltip="{content: 'Your Prime Account address', classes: 'info-tooltip long'}">
        <a :href="`https://snowtrace.io/address/${smartLoanContract.address}`" target="_blank">{{ smartLoanContract.address | tx(true) }}</a></div>
    </div>
    <div class="separator"></div>
    <img class="logo" src="src/assets/logo/metamask.svg"/>
    <div class="account" v-tooltip="{content: 'Your Metamask address', classes: 'info-tooltip long'}">
      <a :href='`https://snowtrace.io/address/${account}`' target="_blank">{{ account | tx(true) }}</a>
    </div>
    <div class="balance">{{ accountBalance | avax }}</div>
    <img class="logo" src="src/assets/icons/avax-icon.svg"/>
  </div>
</template>


<script>
  import { mapState } from "vuex";
  const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';

  export default {
    name: 'Wallet',
    props: {
      title: String
    },
    computed: {
      ...mapState('network', ['provider', 'account', 'accountBalance']),
      ...mapState('fundsStore', ['smartLoanContract', 'noSmartLoan']),
      network() {
        return 'Avalanche';
      },
      hasSmartLoanContract() {
        return this.smartLoanContract && this.smartLoanContract.address !== NULL_ADDRESS;
      },
    },
    data() {
      return {

      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.wallet {
  display: flex;
  font-weight: 500;
  font-size: 14px;

  @media screen and (max-width: $md) {
    font-size: initial;
  }

  a {
    color: #7d7d7d;
  }

  .balance {
    margin-right: 6px;
    margin-left: 6px;
  }

  .prime-account {
    display: flex;
  }
}

.account {
  color: $steel-gray;
  font-weight: 500;
}

.logo {
  height: 16px;
  vertical-align: middle;
  margin-right: 5px;
  transform: translateY(2px);
}

.separator {
  width: 2px;
  height: 25px;
  flex-grow: 0;
  margin: 0 13px 0 14px;
  transform: translateY(-2px);
  border: solid 1px $smoke-gray;
}
</style>

