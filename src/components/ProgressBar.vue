<template>
  <div class="progress-bar-component" v-if="progressBarVisible">
    <div class="background"
         v-bind:class="{'background--success': state === 'SUCCESS', 'background--error': state === 'ERROR', 'background--cancelled': state === 'CANCELLED'}"></div>
    <div v-if="state === 'IN_PROGRESS' || state === 'MINING'"
         class="value-overlay"
         v-bind:class="{'value-overlay__clock-running': state === 'IN_PROGRESS'}"
         v-bind:style="state === 'IN_PROGRESS' ? {'transition': `width ${duration}ms linear`} : {'transition': `width 0s linear`}"></div>
    <div class="text-overlay">
      <div v-if="state === 'MINING'" class="text-overlay__text text-overlay__in-progress">Waiting for confirmation...</div>
      <div v-if="state === 'IN_PROGRESS'" class="text-overlay__text text-overlay__in-progress">Waiting for confirmation...</div>
      <div v-if="state === 'SUCCESS'" class="text-overlay__text text-overlay__success">
        Success
        <img class="text-overlay__icon" src="src/assets/icons/tick-white.svg">
      </div>
      <div v-if="state === 'ERROR'" class="text-overlay__text text-overlay__error">
        Transaction Failed
        <img class="text-overlay__icon" src="src/assets/icons/x-white.svg">
      </div>
      <div v-if="state === 'CANCELLED'" class="text-overlay__text text-overlay__cancelled">
        Transaction Cancelled
        <img class="text-overlay__icon" src="src/assets/icons/x-white.svg">
      </div>
    </div>
  </div>
</template>

<script>
import {mapState} from 'vuex';
import {delay, interval, startWith, timer} from 'rxjs';

export default {
  name: 'ProgressBar',
  data() {
    return {
      value: 0,
      progressBarVisible: false,
      clock: null,
      success: false,
      error: false,
      state: 'IN_PROGRESS',
      duration: 0,
    };
  },
  computed: {
    ...mapState('serviceRegistry', ['progressBarService']),
  },
  mounted() {
    this.watchProgressBarRequest();
    this.watchProgressBarState();
  },
  methods: {
    watchProgressBarRequest() {
      this.progressBarService.progressBarRequested$.subscribe((progressBarRequest) => {
        if (!this.progressBarVisible) {
          this.value = 0;
          this.duration = progressBarRequest.duration;
          this.showProgressBar(progressBarRequest.duration);
        }
      });
    },

    watchProgressBarState() {
      this.progressBarService.progressBarState$.subscribe((state) => {
        this.state = state;
        if (this.progressBarVisible) {
          if (state === 'SUCCESS' || state === 'ERROR' || state === 'CANCELLED') {
            timer(3000).subscribe(() => {
              this.progressBarVisible = false;
            });
          }
        }
      });
    },

    showProgressBar(duration) {
      this.progressBarVisible = true;
      this.state = 'MINING';
      setTimeout(() => {
        this.value = 0;
        this.clock = timer(duration).subscribe(() => {
          // clock finished
        });
      });
    },
  }
};
</script>

<style scoped lang="scss">
@import "~@/styles/variables";

.progress-bar-component {
  position: fixed;
  bottom: 0;
  left: 0;
  height: 36px;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  .background {
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: linear-gradient(to right, #8b8bff 6%, #cd8eff 28%, #ff87bc 55%, #ffba99 104%), linear-gradient(to bottom, #6b70ed, #6b70ed);

    &.background--success {
      background: $lime-green;
    }

    &.background--error {
      background: $red;
    }

    &.background--cancelled {
      background: $orange;
    }
  }

  .value-overlay {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 67%;
    height: 100%;
    background-color: $pearl-gray;

    &.value-overlay__clock-running {
      width: 0;
    }
  }

  .text-overlay {
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    font-size: $font-size-sm;
    z-index: 1;

    .text-overlay__text {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 3px;

      &.text-overlay__in-progress {
        border-radius: 54px;
        background-color: rgba(255, 255, 255, 0.5);
        color: $royal-blue;
        font-weight: 600;
        padding: 1px 10px;
      }

      &.text-overlay__success, &.text-overlay__error, &.text-overlay__cancelled {
        color: white;
        font-weight: bold;
      }
    }
  }
}
</style>