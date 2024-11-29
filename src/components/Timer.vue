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
        currentDate: new Date().getTime() + new Date().getTimezoneOffset() * 60000
      }
    },
    mounted() {
      setInterval(() => {
        this.currentDate = new Date().getTime() + new Date().getTimezoneOffset() * 60000
      }, 1000)
    },
    computed: {
      timerFormatted() {
        return moment(this.date - this.currentDate).format('hh:mm:ss')
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