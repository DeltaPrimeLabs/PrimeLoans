<template>
  <div class="transaction-result-summary-beta-component">
    <div class="summary-wrapper">
      <div class="summary">

        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
import BarGaugeBeta from './BarGaugeBeta';
export default {
  name: 'TransactionResultSummaryBeta',
  components: {BarGaugeBeta}
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.summary-wrapper {
  background-image: linear-gradient(117deg, #dfe0ff 39%, #ffe1c2 62%, #ffd3e0 82%);
  border-radius: 15px;
  display: inline-block;
  padding: 2px;
  width: 100%;

  .summary {
    display: flex;
    flex-direction: column;
    border-radius: 13px;
    background-color: white;
    padding: 1px 16px 1px 16px;

    .summary__title {
      display: flex;
      flex-direction: row;
      font-size: 14px;
      font-weight: 500;
      color: #acabe3;
      justify-content: space-around;
    }

    .summary__horizontal__divider {
      width: 518px;
      height: 2px;
      background-color: #f0f0f0;
    }

    .summary__values {
      display: flex;
      flex-direction: row;
      justify-content: space-around;
      color: $steel-gray;
      margin-top: 9px;
      margin-bottom: 6px;


      > div {
        display: flex;
      }

      .summary__value__pair {
        display: flex;
        flex-direction: column;
        padding-left: 14px;
      }

      .currency {
        font-weight: 400;
      }

      .summary__label {
        margin-right: 5px;

        &.summary__label--error {
          color: $red;
          font-weight: 600;
        }
      }

      .summary__divider {
        width: 2px;
        height: 17px;
        background-color: $smoke-gray;
        margin: 0 10px;

        &.divider--long {
          height: 34px;
          margin: 4px 20px 0 20px;
        }

        &.divider--super-long {
          height: 52px;
          margin: 4px 20px 0 20px;
        }

        &.light {
          background-color: #f0f0f0;
        }
      }

      .summary__value {
        font-weight: 600;
        margin-right: 5px;

        .summary__value--error {
          color: $red;
        }
      }
    }
  }
}

</style>