<template>
  <div class="account-apr-widget-component">
    <div class="apr-section">
      <img src="src/assets/images/apr-sign.svg" class="apr-sign">
      <div class="apr-widget__value">
        <template v-if="accountApr != null">
          <div class="value">
            <ColoredValueBeta :value="accountApr" :formatting="'percent'"
                              :percentage-rounding-precision="1" :big="true"></ColoredValueBeta>
            <InfoIcon class="info__icon"
                      :tooltip="{content: 'How much you annually yield on your collateral. This number includes any inherent asset price appreciation, and borrowing interest.', placement: 'top', classes: 'info-tooltip'}"
                      :classes="'info-tooltip'"></InfoIcon>
          </div>
        </template>
        <div v-else>
          <div class="no-smart-loan-dash" v-if="noSmartLoan">
          </div>
          <div v-else>
            <vue-loaders-ball-beat color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
          </div>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="bull-meter-section">
      <template v-if="bullScore !== undefined && bullScore !== null">
        <MiniPercentageGauge :percentage-value="bullScore * 100" :range="500"></MiniPercentageGauge>
        <InfoIcon :size="16" class="bull-meter-section__info-icon" :tooltip="'The percentage change of your collateral value if all volatile assets appreciate with 100%; your bullishness on the cryptomarket. This Feature is currently in <b>Beta</b>, and excludes liquidation effects.'"></InfoIcon>
      </template>
      <div v-else>
        <vue-loaders-ball-beat color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
      </div>
    </div>
  </div>
</template>

<script>
import ColoredValueBeta from './ColoredValueBeta';
import InfoIcon from "./InfoIcon.vue";
import MiniPercentageGauge from "./stats/MiniPercentageGauge.vue";
import { mapState } from "vuex";

export default {
  name: 'AccountAprWidget',
  components: {MiniPercentageGauge, InfoIcon, ColoredValueBeta},
  props: {
    accountApr: 0,
    noSmartLoan: {},
  },
  data() {
    return {
      bullScore: null
    }
  },
  computed: {
    ...mapState('serviceRegistry', [
      'bullScoreService'
    ]),
  },
  mounted() {
    this.bullScoreService.allHedgeScores$.subscribe(score => {
      this.bullScore = score ? score.ALL : null
    })
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.account-apr-widget-component {
  width: 222px;
  height: 107px;
  display: grid;
  grid-template-columns: 1fr 2px 1fr;
  box-shadow: var(--account-apr-widget-component__box-shadow);
  background-color: var(--account-apr-widget-component__background);
  border-bottom-left-radius: 35px;
  border-bottom-right-radius: 35px;
  padding: 20px 0;

  .apr-widget__title {
    font-size: $font-size-sm;
    font-weight: 500;
    color: var(--account-apr-widget-component__widget-title-color);
    margin-bottom: 4px;
  }

  .apr-widget__value {
    margin-bottom: 2px;

    .no-smart-loan-dash {
      margin: 14px 0;
      width: 20px;
      height: 1px;
      background-color: $steel-gray;
    }
  }

  .apr-widget__comment {
    font-size: $font-size-xsm;
    color: var(--account-apr-widget-component__widget-comment-color);
  }

  .info__icon {
    transform: translateY(-2px);
  }
}

.apr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding-top: 6px;
}

.value {
  display: flex;
  align-items: center;
  height: 29px;
}

.divider {
  width: 100%;
  height: 100%;
  background: var(--account-apr-widget-component__divider-background);
  border-radius: 999px;
}

.bull-meter-section {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;

  &__info-icon {
    position: absolute;
    top: -5px;
    right: 10px;
  }
}

</style>
