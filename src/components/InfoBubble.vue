<template>
  <div class="info-bubble-wrapper" v-if="shouldShow">
    <div class="info-bubble">
      <img src="src/assets/icons/info.svg" class="info"/>
      <div class="text">
        <slot></slot>
      </div>
      <img class="cross clickable-icon" v-if="cacheKey" @click="hide">
    </div>
  </div>
</template>


<script>
  export default {
    name: 'InfoBubble',
    props: {
      cacheKey: '',
      hidden: false
    },
    methods: {
      hide() {
        localStorage.setItem(this.cacheKey, 'false');
        this.hidden = true;
      }
    },
    computed: {
      shouldShow() {
        return !this.hidden && localStorage.getItem(this.cacheKey) !== 'false';
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.info-bubble-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 10px;

  .info-bubble {
    background-image: url("../assets/icons/bubble-mobile.svg");
    background-repeat: no-repeat;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 23px 30px 45px 29px;
    font-weight: 500;
    color: #7d7d7d;
    line-height: 24px;
    font-size: 16px;
    background-size:cover;
    min-height: 230px;

    @media screen and (min-width: $md) {
      background-image: url("../assets/icons/bubble.svg");
      background-size: initial;
      min-height: initial;
      font-size: 14px;
      min-width: 550px;
    }

    .info {
      margin-right: 20px;
    }

    .text {
      text-align: left;
    }

    .cross {
      align-self: flex-start;
      cursor: pointer;
      content: url(../assets/icons/cross.svg);

      &:hover {
        content: url(../assets/icons/hover/cross.svg);
      }
    }

    a {
      color: #7d7d7d;
      font-weight: 600;
    }
  }
}

</style>

