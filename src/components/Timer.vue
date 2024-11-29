<template>
  <div class="timer" v-bind:class="classRecord[status]">
    {{timerFormatted}}
  </div>
</template>

<script>
  import moment from "moment";

  export default {
    name: 'Timer',
    props: {
      status: '',
      date: 0,
    },
    data() {
      return {
        classRecord: {
          READY: 'timer--status-ready',
          PENDING: 'timer--status-pending'
        },
        currentDate: new Date().getTime()
      }
    },
    mounted() {
      setInterval(() => {
        this.currentDate = new Date().getTime()
        if (this.date - this.currentDate <= 0) {
          this.$emit('timerEnded')
        }
      }, 1000)
    },
    computed: {
      timerFormatted() {
        return moment.duration(this.date - this.currentDate).format('hh:mm:ss', {trim: false})
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.timer {
  font-family: monospace;
  font-size: 14px;
  font-weight: 500;

  &--status-ready {
    color: var(--add-to-withdraw-queue__queue-status-color--ready);
  }

  &--status-pending {
    color: var(--add-to-withdraw-queue__queue-status-color--pending);
  }
}
</style>