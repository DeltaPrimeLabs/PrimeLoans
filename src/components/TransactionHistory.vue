<template>
  <StatsSection>
    <div class="transaction-history-component">
      <StatsSectionHeader>
        Prime Account history
      </StatsSectionHeader>

      <div class="transactions-table">
        <TableHeader :config="transactionHistoryTableConfig"></TableHeader>

        <div class="table-body" v-if="transactionHistory">
          <div class="transaction-row" v-for="transaction of transactionHistory">
            <div class="transaction-cell date" v-if="transaction.date">{{ transaction.date | timeAgo }}</div>
            <div class="transaction-cell id" v-if="transaction.date">
              <img class="icon" :src="getExplorerIcon"/>
              <div class="transaction-id-wrapper">
                <a class="transaction-id" :href="`${getExplorerTxUrl}${transaction.id}`" target="_blank">
                  {{ transaction.id | tx(true) }}
                </a>
              </div>
            </div>
            <div class="transaction-cell type">{{ transaction.transactionAction }}</div>
            <div v-if="transaction.basicTransactionAmount" class="transaction-cell amount">
              {{ transaction.fromAmountNumber | smartRound(5, true) | formatWithSpaces }}
              <span class="transaction__cell__token">{{ transaction.fromToken }}</span>
            </div>
            <div v-if="transaction.txType === 'Swap' || transaction.txType === 'DebtSwap'"
                 class="transaction-cell amount-swap">
              {{ transaction.fromAmountNumber | smartRound(5, true) | formatWithSpaces }}
              <span class="transaction__cell__token">{{ transaction.fromToken }}</span>
              <DeltaIcon class="swap-icon" :icon-src="'src/assets/icons/swap-arrow.svg'"
                         :size="16" :no-hover="true"
              ></DeltaIcon>
              {{ transaction.toAmountNumber | smartRound(5, true) | formatWithSpaces }}
              <span class="transaction__cell__token">{{ transaction.toToken }}</span>
            </div>
            <div v-if="transaction.txType === 'AddLiquidity' || transaction.txType === 'RemoveLiquidity'"
                 class="transaction-cell amount-swap">
              {{ transaction.fromAmountNumber | smartRound(5, true) | formatWithSpaces }}
              <span class="transaction__cell__token">{{ transaction.fromToken }}</span>,
              {{ transaction.toAmountNumber | smartRound(5, true) | formatWithSpaces }}
              <span class="transaction__cell__token">{{ transaction.toToken }}</span>
            </div>
          </div>
        </div>
        <div class="loader-container" v-else v-bind:style="`height: ${(pageSize * 60) + 37}px;`">
          <VueLoadersBallBeat color="#A6A3FF" scale="2"></VueLoadersBallBeat>
        </div>
      </div>
      <Paginator v-if="totalTransactions"
                 :page-size="pageSize"
                 :start-page="1"
                 :total-elements="totalTransactions"
                 v-on:pageChange="pageChange">
      </Paginator>
    </div>
  </StatsSection>
</template>

<script>
import {mapState} from 'vuex';
import TableHeader from './TableHeader';
import {formatUnits} from '../utils/calculate';
import config from '../config';
import DeltaIcon from './DeltaIcon';
import Paginator from './Paginator';
import StatsSection from './stats/StatsSection';
import StatsSectionHeader from './stats/StatsSectionHeader';

export default {
  name: 'TransactionHistory',
  components: {
    StatsSection,
    Paginator,
    DeltaIcon,
    TableHeader,
    StatsSectionHeader
  },
  data() {
    return {
      account: {},
      transactionHistoryTableConfig: {},
      transactionHistory: null,
      totalTransactions: 0,
      pageSize: config.TRANSACTION_HISTORY_PAGE_SIZE,
      page: 0,
    };
  },
  computed: {
    ...mapState('serviceRegistry', ['statsService', 'accountService']),
    ...mapState('fundsStore', [
      'smartLoanContract',
    ]),

    getExplorerIcon() {
      switch (window.chain) {
        case 'avalanche': {
          return 'src/assets/logo/snowtrace.png'
        }
        case 'arbitrum': {
          return 'src/assets/logo/arb.png'
        }
      }
    },

    getExplorerTxUrl() {
      switch (window.chain) {
        case 'avalanche': {
          return 'https://snowtrace.dev/tx/'
        }
        case 'arbitrum': {
          return 'https://arbiscan.io/tx/'
        }
      }
    },
  },

  async mounted() {
    this.setupTableHeader();
    await this.initialGetTransactionHistory();
  },

  methods: {
    setupTableHeader() {
      this.transactionHistoryTableConfig = {
        gridTemplateColumns: '240px 240px 1fr 2fr',
        cells: [
          {
            label: 'Date',
            sortable: false,
            class: 'date',
            id: 'DATE',
          },
          {
            label: 'Transaction ID',
            sortable: false,
            class: 'transaction-id',
            id: 'TRANSACTION_ID',
          },
          {
            label: 'Action',
            sortable: false,
            class: 'action',
            id: 'ACTION',
          },
          {
            label: 'Amount',
            sortable: false,
            class: 'amount',
            id: 'AMOUNT',
          },
        ]
      };
    },

    async initialGetTransactionHistory() {
      this.accountService.observeAccountLoaded().subscribe(account => {
        this.account = account;
        this.getTransactionHistory(this.account, this.page, this.pageSize);
      });
    },

    async getTransactionHistory(accountAddress, page, pageSize) {
      const response = await this.statsService.getUserTransactionHistory(accountAddress, page, pageSize);
      if (response.data.user) {
        this.transactionHistory = response.data.user.transactions;
        this.totalTransactions = response.data.user.numTransactions;
        this.$forceUpdate();
        this.transactionHistory = this.transactionHistory.map(transaction => this.parseTransactionData(transaction));
      }
    },

    parseToken: function (transactionAsset) {
      const parsedTokenSymbol = this.parseTokenSymbol(transactionAsset);
      if (parsedTokenSymbol) {
        if (config.ASSETS_CONFIG[parsedTokenSymbol]) {
          return parsedTokenSymbol;
        } else if (config.LP_ASSETS_CONFIG[parsedTokenSymbol]) {
          return config.LP_ASSETS_CONFIG[parsedTokenSymbol].name;
        } else {
          const protocol = Object.values(config.FARMED_TOKENS_CONFIG).flat().find(protocol => protocol.protocolIdentifier === parsedTokenSymbol);
          if (protocol) {
            if (!protocol.isTokenLp) {
              return protocol.token;
            } else {
              return config.LP_ASSETS_CONFIG[protocol.token].name;
            }
          }
        }
      } else {
        return 'AVAX';
      }
    },

    parseTokenSymbol(tokenSymol) {
      switch (tokenSymol) {
        case 'USDTE':
          return 'USDT.e';
        default:
          return tokenSymol;
      }
    },

    parseTransactionAction(transactionAction) {
      const transactionActionMap = {
        'Deposit': 'Deposited',
        'DepositNative': 'Deposited',
        'Withdraw': 'Withdrawn',
        'UnwrapAndWithdraw': 'Withdrawn',
        'Borrow': 'Borrowed',
        'Repay': 'Repaid',
        'Swap': 'Swapped',
        'DebtSwap': 'Swapped debt',
        'Stake': 'Staked',
        'Unstake': 'Unstaked',
        'AddLiquidity': 'Created LP Token',
        'RemoveLiquidity': 'Unwound LP Token',
        'GlpRedeemed': 'GLP redeemed',
        'GlpMint': 'GLP minted',
      };

      return transactionActionMap[transactionAction] ? transactionActionMap[transactionAction] : transactionAction;
    },

    parseTransactionData(transaction) {
      const date = new Date(Number(transaction.timestamp) * 1000);
      const fromAssetDecimals = transaction.fromAsset && config.ASSETS_CONFIG[transaction.fromAsset] ? config.ASSETS_CONFIG[transaction.fromAsset].decimals : 18;
      const fromAmountNumber = fromAssetDecimals && transaction.fromAmount ? formatUnits(transaction.fromAmount, fromAssetDecimals) : null;
      const toAssetDecimals = transaction.toAsset && config.ASSETS_CONFIG[transaction.toAsset] ? config.ASSETS_CONFIG[transaction.toAsset].decimals : 18;
      const toAmountNumber = toAssetDecimals && transaction.toAmount ? formatUnits(transaction.toAmount, toAssetDecimals) : null;

      const fromToken = this.parseToken(transaction.fromAsset);
      const toToken = transaction.toAsset ? this.parseToken(transaction.toAsset) : null;
      const transactionAction = this.parseTransactionAction(transaction.txType);

      const specialTransactionsAmountForTxTypes = ['Swap', 'DebtSwap', 'AddLiquidity', 'RemoveLiquidity'];

      return {
        ...transaction,
        date: date,
        fromAmountNumber: fromAmountNumber,
        toAmountNumber: toAmountNumber,
        fromToken: fromToken,
        toToken: toToken,
        transactionAction: transactionAction,
        basicTransactionAmount: !specialTransactionsAmountForTxTypes.includes(transaction.txType)
      };
    },

    pageChange(page) {
      this.page = page ;
      this.getTransactionHistory(this.account, this.page - 1, this.pageSize);
    },
  }
};
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.transaction-history-component {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 30px 42px 30px 42px;

  .transaction-history__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    font-size: $font-size-mlg;
    font-weight: 500;
    margin-bottom: 60px;
  }

  .transactions-table {

    .transaction-row {
      display: grid;
      grid-template-columns: 240px 240px 1fr 2fr;
      height: 60px;
      border-style: solid;
      border-width: 0 0 2px 0;
      border-image-source: var(--asset-table-row__border);
      border-image-slice: 1;
      margin: 0 22px;

      .transaction-cell {
        display: flex;
        flex-direction: row;
        align-items: center;

        .transaction__cell__token {
          margin-left: 5px;
          color: var(--transaction-history__transaction-token-color);
        }

        &.date {
          justify-content: flex-start;
        }

        &.id {
          justify-content: flex-start;

          .icon {
            width: 16px;
            height: 16px;
            margin-right: 5px;
          }

          .transaction-id-wrapper {
            display: flex;
            flex-direction: row;

            .transaction-id {
              color: var(--transaction-history__transaction-token-color);
            }
          }
        }

        &.type {
          justify-content: flex-start;
          padding-left: 8px;
        }

        &.amount {
          justify-content: flex-end;
          font-weight: 500;
        }

        &.amount-swap {
          justify-content: flex-end;
          font-weight: 500;

          .swap-icon {
            margin: 0 5px;
            transform: rotate(270deg);
            background: var(--icon-button__icon-color--default);

            &:hover {
              background: var(--icon-button__icon-color-hover--default);
            }
          }
        }
      }
    }

    .loader-container {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
    }
  }

}
</style>
