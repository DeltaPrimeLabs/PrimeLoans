<template>
  <div class='tab' v-show='isActive'>
    <slot></slot>
  </div>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: 'Tab'
    },
    imgActive: String,
    imgNotActive: String,
    imgPosition: String,
    titleWidth: String
  },
  data () {
    return {
      isActive: true
    }
  }
}
</script>

<style lang="scss">
@import "~@/styles/variables";

.tab {
  display: flex;
  justify-content: center;
  margin-top: 20px;

  @media screen and (min-width: $md) {
    margin-top: 0;
  }
}
</style>
