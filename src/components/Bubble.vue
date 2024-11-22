<template>
  <div class="bubble">
    <div class="solid-block-wrapper">
      <slot>
      </slot>
    </div>
    <div class="arrow-wrapper">
      <img src="src/assets/icons/arrow-bubble-bottom-right.svg"
           v-bind:class="{
          'bottom-left': arrowDirection === 'bottom-left',
          'top-left': arrowDirection === 'top-left',
          'top-right': arrowDirection === 'top-right',
         }"
      >
    </div>
  </div>
</template>


<script>
  export default {
    name: 'Bubble',
    props: {
      bordered: false,
      arrowDirection: {
        type: String,
        default: 'bottom-right'
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.bubble {
  position: absolute;
  z-index: 0;
  transform: translate(-211px, -178px);
}

.solid-block-wrapper {
  background-color: #6b70ed;
  border-radius: 20px;
  padding: 16px 30px;
  width: 329px;
  font-weight: 500;
  font-size: 16px;
  color: white;
}

.arrow-wrapper {
  position: relative;

  img {
    position: absolute;
    transform: translate(154px, -9px);

    &.bottom-left {
      -webkit-transform: scaleX(-1);
      transform: scaleX(-1);
    }

    &.top-left {
      transform: rotate(180deg);
    }

    &.top-right {
      -webkit-transform: scaleY(-1);
      transform: scaleY(-1);
    }
  }
}

</style>

