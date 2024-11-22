<template>
  <div class="small-block-wrapper">
    <div class="small-block">
      <img class="cross clickable-icon" @click="onClose"/>
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: "SmallBlock",
  methods: {
    onClose() {
      this.$emit('close',true);
    }
  }
}
</script>

<style scoped lang="scss">
.small-block-wrapper {
  background-image: linear-gradient(117deg, #dfe0ff 39%, #ffe1c2 62%, #ffd3e0 82%);
  border-radius: 25px;
  padding: 2px;
  box-shadow: 4px 4px 14px 0 rgba(191, 188, 255, 0.25);
  height: 100%;

  .small-block {
    display: flex;
    flex-direction: column;
    background: white;
    padding: 16px 16px;
    border-radius: 23px;
    height: 100%;

    .cross {
      align-self: flex-end;
      content: url(../assets/icons/cross.svg);

      &:hover {
        content: url(../assets/icons/hover/cross.svg);
      }
    }
  }
}
</style>
