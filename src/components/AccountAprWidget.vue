<template>
  <div class="account-apr-widget-component">
    <div class="apr-section">
      <div class="apr-widget__title">
        Points
      </div>
      <div class="apr-widget__value">
        <template>
          <div class="value">
            3289
          </div>
        </template>
      </div>
    </div>
    <div class="divider"></div>
    <div class="bull-meter-section">
      <MiniPercentageGauge v-if="bullScore !== undefined && bullScore !== null" :percentage-value="bullScore * 100"></MiniPercentageGauge>
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
    noSmartLoan: {},
  },
  data() {
    return {
      bullScore: 0.8,
      accountApr: 92,
    }
  },
  computed: {
    ...mapState('serviceRegistry', [
      'bullScoreService'
    ]),
  },
  mounted() {
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

    .value {
      font-size: 17px;
      font-weight: bold;
      display: flex;
      justify-content: center;
      line-height: 0.8;
      color: var(--account-apr-widget-component__widget-value-color);
    }

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
  display: flex;
  justify-content: center;
  align-items: center;
}

</style>
