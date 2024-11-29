<template>
  <div class="withdraw-queue-component">
    <div class="withdraw-accordion" v-bind:class="{'withdraw-accordion--expanded': isExpanded}">
      <div class="header" v-on:click="toggleExpanded()">
        <div class="arrow" v-if="amountOfQueues() > 0">
          <DeltaIcon class="chevron" :icon-src="'src/assets/icons/chevron-down.svg'" :size="21"></DeltaIcon>
        </div>
        <div class="header-body--expanded header-text">Withdrawal Queue</div>
        <div class="header-body">
          <div class="header-text">Withdrawal Queue</div>
          <div class="summary">
            <template v-if="amountOfQueues() > 0">
              <div class="summary__label">Pending:</div>
              <div class="summary__value">{{ pendingCount }}</div>
              <div class="summary__divider"></div>
              <div class="summary__label">Ready:</div>
              <div class="summary__value">{{ readyCount }}</div>
              <template v-if="soon">
                <div class="summary__divider"></div>
                <div class="summary__label">{{ soon.isPending ? 'Ready' : 'Expires' }} soon:</div>
                <div class="summary__value">{{ soon.amount }} {{ soon.symbol }}</div>
                <Timer :status="soon.isPending ? 'PENDING' : 'READY'"></Timer>
              </template>
            </template>
          </div>
          <div></div>
        </div>
      </div>
      <div class="body">
        <div class="queue-per-token" v-for="(entries, asset) in allQueues">
          <WithdrawalQueuePerToken :asset-symbol="asset" :entries="entries"></WithdrawalQueuePerToken>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import DeltaIcon from "../DeltaIcon.vue";
import Timer from "../Timer.vue";
import WithdrawalQueuePerToken from "./WithdrawalQueuePerToken.vue";

export default {
  name: 'WithdrawalQueue',
  components: {
    WithdrawalQueuePerToken,
    DeltaIcon,
    Timer
  },
  props: {
    allQueues: {},
    pendingCount: 10,
    readyCount: 10,
    soon: {},
  },

  data() {
    return {
      isExpanded: false
    };
  },

  mounted() {
  },

  computed: {},

  methods: {
    amountOfQueues() {
      return this.allQueues ? Object.keys(this.allQueues).length : 0
    },
    toggleExpanded() {
      if (this.amountOfQueues() > 0) {
        this.isExpanded = !this.isExpanded
      }
    },
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.withdraw-accordion {
  background: var(--withdrawal-queue__withdraw-accordion-background);
  box-shadow: var(--withdrawal-queue__withdraw-accordion-shadow);
  border-radius: 35px;

  &--expanded {
    .chevron {
      transform: rotate(180deg);
    }

    .header {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    .body {
      height: auto;
      border-top: none;
      border-bottom-left-radius: 32px;
      border-bottom-right-radius: 32px;
    }

    .header-body {
      opacity: 0;

      &--expanded {
        opacity: 1;
      }
    }
  }
}

.header {
  position: relative;
  transition: border-radius 200ms ease-in-out;
  cursor: pointer;
  border-radius: 30px;
}

.header-body {
  display: grid;
  grid-template-columns: 170px 10fr 170px;
  padding: 20px 24px 20px 26px;
}

.header-body--expanded {
  position: absolute;
  opacity: 0;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.summary {
  display: flex;
  flex-direction: row;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  gap: 8px;

  &__label {
    color: var(--withdrawal-queue-per-token__summary-label-color);
  }

  &__value {
    color: var(--withdrawal-queue-per-token__summary-value-color);
  }

  &__additional-info {
    color: var(--withdrawal-queue-per-token__summary-additional-info-color);
  }

  &__divider {
    height: 100%;
    width: 2px;
    margin: 0 19px;
    background: var(--withdrawal-queue-per-token__summary-divider-background);
  }
}

.arrow {
  position: absolute;
  top: 50%;
  right: 24px;
  transform: translateY(-50%);
  display: flex;
  justify-content: flex-end;
}

.chevron {
  transition: transform 200ms ease-in-out;
  background: var(--withdrawal-queue-per-token__header-chevron-background);
}

.body {
  height: 0;
  transition: height 200ms ease-in-out;
  overflow: hidden;
  padding: 0 20px;
}

.queue-per-token {
  &:not(:last-child) {
    margin-bottom: 20px;
  }

  &:last-child {
    margin-bottom: 60px;
  }
}

.header-text {
  font-size: 16px;
  font-weight: 600;
}

</style>
