<template>
  <div class="rtkn-panel-component" v-bind:class="{'rtkn-panel-component--expanded': expanded}">
    <div class="header-actions">
      <div v-on:click="toggleExpand()">
        <DeltaIcon class="chevron" v-bind:class="{'chevron--expanded': expanded}"
                   :icon-src="'src/assets/icons/chevron-down.svg'" :size="21"></DeltaIcon>
      </div>
    </div>
    <div class="rtkn-panel__actions rtkn-panel__actions--collapsed">
      <div class="sprime">
        <img class="sprime-logo"
             :src="`src/assets/logo/rtkn.svg`"/>
        <img class="sprime-logo"
             :src="`src/assets/logo/rtkn-2.svg`"/>
        <div class="sprime__text">
          rTKNs
        </div>
      </div>
      <div class="actions-info">
        <div class="actions-info__entry">
          <div class="actions-info__label">My rTKNs:</div>
          <div class="actions-info__value">
            {{ (Number(data[0].rtknBalance) + Number(data[1].rtknBalance)) | smartRound(2, true) }}
            <span class="actions-info__value--secondary">
              ({{ data[0].rtknBalance | smartRound(2, true) }}
              <img v-if="!data[1].fake" class="sprime-logo"
                   :src="`src/assets/logo/rtkn.svg`"/>
              <span v-if="!data[1].fake">{{ data[1].rtknBalance | smartRound(2, true) }}</span>
              <img class="sprime-logo"
                   :src="`src/assets/logo/rtkn-2.svg`"/>)
            </span>
          </div>
        </div>
        <div class="actions-info__divider"></div>
        <div class="actions-info__entry">
          <div class="actions-info__label">PRIME Expected:</div>
          <div class="actions-info__value">
            {{ (Number(data[0].eligiblePrime) + Number(data[1].eligiblePrime)) | smartRound(3, true) }}
          </div>
          <div class="actions-info__value--secondary">
            ({{ (Number(data[0].eligiblePrime) + Number(data[1].eligiblePrime)) * primePrice | usd }})
          </div>
        </div>
        <div class="actions-info__divider"></div>
        <div class="actions-info__entry">
          <div class="actions-info__label">rTKNs Cap:</div>
          <div class="actions-info__value">
            {{ crossChainData.maxCap | smartRound(2, true) | formatWithSpaces }}
            <span class="actions-info__value--secondary">
              (<img class="sprime-logo"
                    :src="`src/assets/logo/rtkn.svg`"/>
              +
              <img class="sprime-logo"
                   :src="`src/assets/logo/rtkn-2.svg`"/>)
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="rtkn-panel__actions rtkn-panel__actions--expanded">
      <div class="sprime">
        <img v-if="!data[1].fake" class="sprime-logo"
             :src="`src/assets/logo/rtkn.svg`"/>
        <img class="sprime-logo"
             :src="`src/assets/logo/rtkn-2.svg`"/>
        <div>
          rTKNs
        </div>
      </div>
      <div class="rtkn-panel__divider"></div>
    </div>
    <div class="rtkn-panel__body">
      <div class="stats">
        <div class="stat">
          <div class="stat__title">My rTKNs
            <InfoIcon class="stat__info-icon" :size="16"
                      :tooltip="{ content: 'These are the rTKNs you currently have. Every rTKN you keep will be redeemable for its equivalent in USDC as DeltaPrime continues to make revenue.'}"></InfoIcon>
          </div>
          <div class="stat__value">
            {{ (Number(data[0].rtknBalance) + Number(data[1].rtknBalance)) | smartRound(2, false ) }}
            <span class="stat__value--secondary">
              ({{ data[0].rtknBalance | smartRound(2, true) }}
              <img v-if="!data[1].fake" class="sprime-logo"
                   :src="`src/assets/logo/rtkn.svg`"/>
              <span v-if="!data[1].fake">{{ data[1].rtknBalance | smartRound(2, true) }}</span>
              <img class="sprime-logo"
                   :src="`src/assets/logo/rtkn-2.svg`"/>)
            </span>
          </div>
        </div>
        <div class="stat">
          <div class="stat__title">PRIME to receive
            <InfoIcon class="stat__info-icon" :size="16"
                      :tooltip="{ content: 'The PRIME you will receive starting July 1st, 2025. You will receive a daily amount of 1/730th of this PRIME for two years.'}"></InfoIcon>
          </div>
          <div class="stat__value">
            {{ (Number(data[0].eligiblePrime) + Number(data[1].eligiblePrime)) | smartRound(3, true) }}
            <span class="stat__value--secondary">
              ({{ (Number(data[0].eligiblePrime) + Number(data[1].eligiblePrime)) * primePrice | usd }})
            </span>
          </div>
        </div>
        <div class="stat">
          <div class="discount">
            <div class="discount__label">
              Distribution
              <InfoIcon class="stat__info-icon" :size="16"></InfoIcon>
            </div>
            <div v-if="!data[1].fake" class="discount__value">
              1 rTKN = {{ data[0].conversionRatio | smartRound(3, true) }} PRIME
            </div>
            <div class="discount__value">
              1 rTKN2 = {{ data[0].conversionRatio | smartRound(3, true) }} PRIME
            </div>
          </div>
        </div>
      </div>
      <div class="total-stats">
        <div class="total-stats__title">Commited</div>
        <div class="power-gauge">
          <div class="gauge__value">
            {{ (Number(crossChainData.totalPledged) / Number(crossChainData.maxCap)) * 100 | smartRound(2, true) }}%
          </div>
        </div>
      </div>
      <div class="rates">
        <div class="rate">
          <div class="rate__title">Total rTKN CAP</div>
          <div class="rate__value total-stats-rate">
            {{ crossChainData.maxCap | smartRound(2, true) | formatWithSpaces }}
            <span class="rate__value--secondary">
              (<img class="sprime-logo"
                    :src="`src/assets/logo/rtkn.svg`"/>
              +
              <img class="sprime-logo"
                   :src="`src/assets/logo/rtkn-2.svg`"/>)
            </span>
          </div>
        </div>
        <div class="rate">
          <div class="rate__title">Total rTKN Commited</div>
          <div class="rate__value total-stats-rate">
            {{ crossChainData.totalPledged | smartRound(2, true) | formatWithSpaces }}
            <span class="rate__value--secondary">
              (<img class="sprime-logo"
                    :src="`src/assets/logo/rtkn.svg`"/>
              +
              <img class="sprime-logo"
                   :src="`src/assets/logo/rtkn-2.svg`"/>)
            </span>
          </div>
        </div>
        <div class="rate">
          <div class="rate__title">
            Total PRIME shared
            <InfoIcon class="stat__info-icon" :size="16"
                      :tooltip="{ content: 'This PRIME will be shared with the community members from the Team allocation. Therefore it does not lead to inflation of the token.'}"></InfoIcon>
          </div>
          <div class="rate__value">
            {{ Number(crossChainData.totalPledged) * data[0].conversionRatio | smartRound(2, true) | formatWithSpaces }}
            <div class="rate__value--usd">
              ({{ Number(crossChainData.totalPledged) * data[0].conversionRatio * primePrice | smartRound(2, true) | usd }})
            </div>
          </div>
        </div>
      </div>

      <div class="faq">
        <div class="faq__title">FAQ</div>
        <div class="faq__links">
          <RTKNPanelFAQ></RTKNPanelFAQ>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import FlatButton from './FlatButton.vue';
import DistributionChart from './DistributionChart.vue';
import DeltaIcon from './DeltaIcon.vue';
import InfoIcon from './InfoIcon.vue';
import PriceRangeChart from './PriceRangeChart.vue';
import SmallBlock from './SmallBlock.vue';
import RTKNPanelFAQ from './RTKNPanelFAQ.vue';

const ethers = require('ethers');


export default {
  name: 'RTKNPanel',
  components: {RTKNPanelFAQ, SmallBlock, PriceRangeChart, InfoIcon, DeltaIcon, DistributionChart, FlatButton},
  props: {
    data: {},
    primePrice: {},
    crossChainData: {},
  },
  data() {
    return {
      expanded: false
    };
  },
  mounted() {
  },
  watch: {},
  computed: {},
  methods: {

    toggleExpand() {
      this.expanded = !this.expanded;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.rtkn-panel-component {
  position: relative;
  height: 60px;
  transition: height 200ms ease-in-out;
  display: flex;
  flex-direction: column;
  border-radius: 35px;
  background-color: var(--s-prime-panel__panel-background-color);
  box-shadow: var(--s-prime-panel__panel-box-shadow);
  margin-top: 30px;
  overflow: hidden;

  .header-actions {
    position: absolute;
    top: 17px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    z-index: 1;

    .chevron {
      cursor: pointer;
      background: var(--s-prime-panel__chevron-color);
      transition: transform 200ms ease-in-out;

      &:hover {
        background: var(--s-prime-panel__chevron-color--hover);
      }

      &.chevron--expanded {
        transform: rotate(180deg);
      }
    }

    .buy-prime-logo {
      width: 20px;
      height: 20px;
      margin-left: 6px;
    }
  }

  &.rtkn-panel-component--expanded {
    height: 373px;

    .rtkn-panel__actions--expanded {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .rtkn-panel__actions--collapsed {
      opacity: 0;
      transform: translateY(100%) !important;
      pointer-events: none;
    }
  }

  .rtkn-panel__actions {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    padding: 16px 0;
    transition: opacity 200ms ease-in-out, transform 200ms ease-in-out;
    transform: translateY(-100%);

    &--expanded {
      opacity: 0;
      pointer-events: none;

      .sprime-logo {
        width: 22px;
        height: 22px;
      }
    }

    &--collapsed {
      position: absolute;
      width: 100%;
      transform: translateY(0);
      padding: 17px 0;

      .sprime {
        position: absolute;
        left: 24px;
        top: 19px;
      }

      .sprime-logo {
        width: 22px;
        height: 22px;
      }

      .sprime__text {
        color: var(--s-prime-panel__secondary-text-color);
        font-size: 16px;
        font-weight: 600;
      }

      .actions-info {
        display: flex;
        justify-content: center;
        align-items: center;

        .actions-info__entry:not(:last-child) {
          margin-right: 19px;
        }

        .actions-info__divider {
          background: var(--s-prime-panel__actions-info-divider-background);
          margin-right: 19px;
          height: 20px;
          width: 2px;
          border-radius: 2px;
        }

        .actions-info__entry {
          display: flex;
          font-size: 16px;
          font-weight: 500;
        }

        .actions-info__label {
          margin-right: 8px;
          color: var(--s-prime-panel__main-text-color);
        }

        .actions-info__value {
          color: var(--s-prime-panel__secondary-text-color);

          &--secondary {
            color: var(--rtkn-panel__value--secondary-color);
          }
        }

        .actions-info__distribution-icon {
          margin-top: -5px;
        }
      }
    }

    .sprime {
      margin-right: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--s-prime-panel__sprime-color);
      font-size: 16px;
      font-weight: 600;
    }

    .actions {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;

      .flat-button-component:not(:last-child) {
        margin-right: 20px;
      }
    }
  }

  .rtkn-panel__divider {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    height: 2px;
    width: 100%;
    background: var(--s-prime-panel__divider-background);
    flex-shrink: 0;
  }

  .rtkn-panel__body {
    padding: 30px 50px;
    display: grid;
    grid-template-columns: 230px 240px 220px 1fr;

    .stats {
      display: flex;
      flex-direction: column;
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;
      padding-top: 10px;

      .stat {
        display: flex;
        flex-direction: column;
        margin-bottom: 18px;

        .stat__info-icon {
          margin-left: 6px;
        }

        .stat__title {
          display: flex;
          align-items: center;
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--s-prime-panel__main-text-color);
        }

        .stat__value {
          font-size: 18px;
          font-weight: 500;
          color: var(--s-prime-panel__secondary-text-color);

          &--secondary {
            color: var(--rtkn-panel__value--secondary-color);
          }
        }

        .stat__extra-info {
          font-size: 14px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          margin-top: 4px;
        }

        .discount {
          align-self: baseline;
          border-radius: 7px;
          padding: 3px 0;
          border: var(--rtkn-panel__discount-border);
          box-shadow: var(--rtkn-panel__discount-box-shadow);

          .discount__label {
            display: flex;
            flex-direction: row;
            align-items: center;
            padding: 0 10px 3px 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--rtkn-panel__discount-label-color);
            border-bottom: var(--rtkn-panel__discount-border);
            font-weight: 600;
            font-size: $font-size-xs;
          }

          .discount__value {
            padding: 6px 10px 4px 10px;
            color: var(--rtkn-panel__discount-value-color);
            font-size: $font-size-sm;
            font-weight: 500;
          }
        }


      }
    }


    .total-stats {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 10px;


      .total-stats__title {
        margin-bottom: 20px;
        color: var(--s-prime-panel__main-text-color);
        font-size: 16px;
        font-weight: 500;
      }

      .power-gauge {
        position: relative;
        width: 160px;
        height: 160px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        box-shadow: var(--s-prime-panel__gauge-box-shadow);

        &:before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--s-prime-panel__gauge-border);
          border-radius: 50%;
          mask-image: radial-gradient(closest-side, transparent calc(100% - 2px), black calc(100% - 2px));
        }

        .gauge__value {
          font-size: 40px;
          font-weight: 600;
          color: var(--s-prime-panel__gauge-text-color);
        }
      }
    }

    .rates {
      padding-top: 10px;
      border-style: solid;
      border-width: 0 2px 0 0;
      border-image-source: var(--stats-bar-beta__divider-background);
      border-image-slice: 1;

      .rate {
        display: flex;
        flex-direction: column;

        &:not(:last-child) {
          margin-bottom: 30px;
        }

        .rate__title {
          font-size: 16px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          padding-bottom: 6px;
        }

        .rate__value {
          font-size: 18px;
          font-weight: 500;
          color: var(--s-prime-panel__secondary-text-color);

          &.total-stats-rate {
            &.negative {
              color: var(--currency-input__error-color);
            }
          }

          &--usd {
            color: var(--rtkn-panel__value--secondary-color);
          }

          &--secondary {
            color: var(--rtkn-panel__value--secondary-color);
          }
        }

        .rate__extra-info {
          font-size: 14px;
          font-weight: 500;
          color: var(--s-prime-panel__main-text-color);
          margin-top: 4px;
        }
      }
    }

    .faq {
      padding-left: 50px;

      .faq__title {
        margin-bottom: 20px;
        color: var(--s-prime-panel__main-text-color);
        font-size: 16px;
        font-weight: 500;
        padding-left: 50px;
      }
    }
  }
}


</style>
