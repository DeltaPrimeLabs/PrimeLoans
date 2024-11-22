<template>
  <div class="loaded-value-component">
    <div v-if="(!check || check()) && value">{{value}}<slot></slot></div>
    <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
  </div>
</template>

<script>
  export default {
    name: 'LoadedValue',
    props: {
      check: Function,
      value: String
    },
    data() {
      return {}
    }
  }
</script>

<style lang="scss" scoped>

</style>

