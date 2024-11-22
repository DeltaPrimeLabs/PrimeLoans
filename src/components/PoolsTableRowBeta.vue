<template>
  <div class="pools-table-row-component">
    <div class="table__row" v-if="pool">
      <div class="table__cell asset">
        <img class="asset__icon" :src="getAssetIcon(pool.asset.symbol)">
        <div class="asset__info">
          <div class="asset__name">{{ pool.asset.symbol }}</div>
        </div>
      </div>

      <div class="table__cell table__cell--double-value deposit">
        <template>
          <div class="double-value__pieces">
            <LoadedValue :check="() => pool.deposit != null" :value="formatTokenBalance(pool.deposit)"></LoadedValue>
          </div>
          <div class="double-value__usd">
            <span v-if="pool.deposit">{{ pool.deposit * pool.assetPrice | usd }}</span>
          </div>
        </template>
        <template v-if="pool.deposit === 0">
          <div class="no-value-dash"></div>
        </template>
      </div>

      <div class="table__cell apy">
        <LoadedValue :check="() => pool.apy != null" :value="formatPercent(pool.apy)">
        </LoadedValue>
      </div>

      <div class="table__cell table__cell--double-value tvl">
        <div class="double-value__pieces">
          <LoadedValue :check="() => pool.tvl != null" :value="formatTokenBalance(pool.tvl)"></LoadedValue>
        </div>
        <div class="double-value__usd">
          <span v-if="pool.tvl">{{ pool.tvl * pool.assetPrice | usd }}</span>
        </div>
      </div>

      <div></div>

      <div class="table__cell actions">
        <IconButtonMenuBeta
          class="actions__icon-button"
          v-for="(actionConfig, index) of actionsConfig"
          :disabled="!pool.contract"
          v-bind:key="index"
          :config="actionConfig"
          v-on:iconButtonClick="actionClick">
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
const ethers = require('ethers');
import addresses from "../../common/addresses/avax/token_addresses.json";
import erc20ABI from '../../test/abis/ERC20.json';


export default {
  name: 'PoolsTableRowBeta',
  components: {LoadedValue, IconButtonMenuBeta},
  props: {
    pool: {}
  },

  mounted() {
    this.setupActionsConfiguration();
  },

  data() {
    return {
      actionsConfig: null,
    };
  },

  computed: {
    ...mapState('network', ['account', 'accountBalance', 'provider'])
  },

  methods: {
    ...mapActions('poolStore', ['deposit', 'withdraw']),
    setupActionsConfiguration() {
      this.actionsConfig = [
        {
          iconSrc: 'src/assets/icons/plus.svg',
          hoverIconSrc: 'src/assets/icons/plus_hover.svg',
          tooltip: 'Deposit',
          iconButtonActionKey: 'DEPOSIT'
        },
        {
          iconSrc: 'src/assets/icons/minus.svg',
          hoverIconSrc: 'src/assets/icons/minus_hover.svg',
          tooltip: 'Withdraw',
          iconButtonActionKey: 'WITHDRAW'
        },
      ];
    },

    actionClick(key) {
      switch (key) {
        case 'DEPOSIT':
          this.openDepositModal();
          break;
        case 'WITHDRAW':
          this.openWithdrawModal();
          break;
      }
    },

    async getWalletAssetBalance() {
      const tokenContract = new ethers.Contract(addresses[this.pool.asset.symbol], erc20ABI, this.provider.getSigner());
      return await this.getWalletTokenBalance(this.account, this.pool.asset.symbol, tokenContract, false);
    },

    async openDepositModal() {
      const modalInstance = this.openModal(DepositModal);
      modalInstance.apy = this.pool.apy;
      modalInstance.walletAssetBalance = await this.getWalletAssetBalance();
      modalInstance.accountBalance = this.accountBalance;
      modalInstance.deposit = this.pool.deposit;
      modalInstance.assetSymbol = this.pool.asset.symbol;
      modalInstance.$on('DEPOSIT', depositEvent => {
        const depositRequest = {
          assetSymbol: this.pool.asset.symbol,
          amount: depositEvent.value,
          depositNativeToken: depositEvent.depositNativeToken
        };

        this.handleTransaction(this.deposit, {depositRequest: depositRequest}, () => {
          this.pool.deposit = Number(this.pool.deposit) + depositRequest.amount;
          this.$forceUpdate();
        }, () => {

        }).then(() => {
          this.closeModal();
        });
      });
    },

    openWithdrawModal() {
      const modalInstance = this.openModal(PoolWithdrawModal);
      modalInstance.apy = this.pool.apy;
      modalInstance.available = this.pool.asset.balance;
      modalInstance.deposit = this.pool.deposit;
      modalInstance.assetSymbol = this.pool.asset.name;
      modalInstance.$on('WITHDRAW', withdrawEvent => {
        const withdrawRequest = {
          assetSymbol: this.pool.asset.symbol,
          amount: withdrawEvent.value,
          withdrawNativeToken: withdrawEvent.withdrawNativeToken,
        };
        this.handleTransaction(this.withdraw, {withdrawRequest: withdrawRequest}, () => {
          this.pool.deposit = Number(this.pool.deposit) - withdrawRequest.amount;
          this.$forceUpdate();
        }, () => {

        }).then(() => {
          this.closeModal();
        });
      });
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
    grid-template-columns: repeat(3, 1fr) 20% 1fr 76px 22px;
    height: 60px;
    border-style: solid;
    border-width: 0 0 2px 0;
    border-image-source: linear-gradient(to right, #dfe0ff 43%, #ffe1c2 62%, #ffd3e0 79%);
    border-image-slice: 1;
    padding-left: 6px;

    .table__cell {
      display: flex;
      flex-direction: row;

      &.asset {
        align-items: center;

        .asset__icon {
          width: 20px;
          height: 20px;
        }

        .asset__info {
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-left: 8px;
          font-weight: 500;
        }
      }

      &.deposit {
        align-items: flex-end;
      }

      &.apy {
        align-items: center;
        justify-content: flex-end;
        font-weight: 500;
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
          color: $medium-gray;
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
        background-color: $medium-gray;
      }
    }
  }

}

</style>