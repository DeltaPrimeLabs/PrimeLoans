<template>
  <div class="menu" id="menu" ref="menu">
    <slot></slot>
  </div>
</template>


<script>
  export default {
    name: 'Menu',
    props: {
      clickElementId: String
    },
    methods: {
      closeIfClickOutside(event) {
        if (this.$refs.menu && !this.$refs.menu.contains(event.target) && !document.getElementById(this.clickElementId).contains(event.target)) {
          this.$emit('close',true);
        }
      }
    },
    mounted() {
      document.body.addEventListener('click', this.closeIfClickOutside);
    },
    unmounted() {
      document.body.removeEventListener('click', this.closeIfClickOutside);
    }
  }
</script>

<style lang="scss" scoped>
.menu {
  padding: 14px 20px;
  border-radius: 10px;
  box-shadow: 2px 2px 8px 0 rgba(175, 171, 255, 0.5);
  border: solid 2px #d1ceff;
  background-color: white;
  color: #696969;

  > div {
    cursor: pointer;

    &:hover {
      color: black;
    }
  }
}
</style>

