<template>
  <div class="health-wrapper" :class="{ 'close-to-insolvent': closeToInsolvent, 'insolvent': insolvent }">
    <div class="health-value">
      <LoadedValue :value="health | percent"></LoadedValue>
    </div>
    <div class="bar-wrapper">
      <div class="health-info">{{info}}</div>
      <div class="bar">
        <div class="health-state" :style="{'width': width}">
        </div>
        <div class="range"><span>0%</span><span>100%</span></div>
      </div>
    </div>
  </div>
</template>

<script>
import LoadedValue from "@/components/LoadedValue.vue";

export default {
  name: 'HealthBar',
  components: {
    LoadedValue
  },
  props: {
    health: Number
  },
  data() {
    return {
    }
  },
  computed: {
    closeToInsolvent() {
      return 0 < this.health && this.health < this.minAllowedHealth;
    },
    insolvent() {
      return this.health === 0
    },
    info() {
      if (this.insolvent) {
        return "Loan is insolvent and can be liquidated"
      } else if (this.closeToInsolvent) {
        return "Loan is close to liquidation"
      } else {
        return "You are doing great!"
      }
    },
    width() {
      return `${this.health * 100}%`;
    }
  }
}
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.health-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;

  @media screen and (min-width: $md) {
    align-items: center;
  }

  .health-value {
    font-size: 20px;
  }

  .health-info {
    color: #7d7d7d;
    margin-top: 7px;
    margin-bottom: 9px;
  }

  &.close-to-insolvent {
    .health-info, .health-value {
      color: #FC6AB0;
    }

    .bar {
      .health-state {
        background-image: linear-gradient(to left, #f590e6 54%, #ff61a4 91%);
      }
    }
  }

  &.insolvent {
    .health-info, .health-value {
      color: #F64254;
    }

    .bar {
      .health-state {
        background-image: none;
        background-color: #f64254;
      }
    }
  }
}

.bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;

  @media screen and (min-width: $md) {
    align-items: center;
  }

  .bar {
    position: relative;
    height: 17px;
    width: 108px;
    border-radius: 9.5px;
    box-shadow: inset 0 1px 3px 0 rgba(191, 188, 255, 0.7);
    background-color: rgba(191, 188, 255, 0.2);
    margin-bottom: 10px;
    clip-path: inset(0 0 0 0 round 9.5px);

    .range {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #7d7d7d
    }

    .health-state {
      height: 17px;
      background-image: linear-gradient(to right, #a5a9ff 17%, #c0a6ff 91%);
      border-bottom-left-radius: 9.5px;
      border-top-left-radius: 9.5px;
    }
  }
}

.info {
  margin-top: 4px;
  text-align: center;
  color: #696969;
  font-size: 14px;
  opacity: 0.6;
}

.inner-text {
  font-size: 24px;
}
</style>
