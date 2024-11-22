<template>
  <div class="double-asset-icon-component">
    <div class="double-icon">
      <div class="icon icon__secondary">
        <img class="icon__img" :src="logoSrc(secondary)">
      </div>
      <div class="icon icon__primary">
        <img class="icon__img" :src="logoSrc(primary)">
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DoubleAssetIcon',
  props: {
    primary: null,
    secondary: null,
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.double-asset-icon-component {
  display: flex;

  .double-icon {
    display: flex;
    flex-direction: row-reverse;

    .icon {
      width: 22px;
      height: 22px;
      border-radius: 22px;
      filter: drop-shadow(1.36364px 0px 3px rgba(44, 0, 169, 0.15));

      &.icon__primary {
        width: 24px;
        height: 24px;
      }

      &.icon__secondary {
        margin-left: -6px;
      }

      .icon__img {
        width: 22px;
        height: 22px;
      }
    }
  }
}

</style>