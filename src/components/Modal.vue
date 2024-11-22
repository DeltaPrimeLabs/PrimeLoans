<template>
  <div class="modal-component">
    <div class="modal-container">
      <div class="backdrop">
        <div class="modal">
          <div class="close-button-container">
            <img class="close-button" src="../assets/icons/cross.svg" v-on:click="close()">
          </div>
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Modal',
  methods: {
    close() {
      this.closeModal();
    }
  },
  props: {
  }
};
</script>

<style lang="scss" scoped>

.modal-component {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  .modal-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    .backdrop {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      height: 100%;
      -webkit-backdrop-filter: blur(25px);
      backdrop-filter: blur(25px);

      .modal {
        position: absolute;
        width: 750px;
        border-radius: 21px;
        box-shadow: 4px 4px 20px 0 rgba(155, 130, 255, 0.15);
        background-color: white;
        padding: 60px 100px;

        &::after {
          position: absolute;
          top: -4px;
          bottom: -4px;
          left: -4px;
          right: -4px;
          background-image: linear-gradient(143deg, #c9cbff 26%, #ffd8b1 60%, #fcb7cc 91%);
          content: '';
          z-index: -1;
          border-radius: 25px;
        }
      }

      .close-button-container {
        position: absolute;
        top: 16px;
        right: 16px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;

        .close-button {
          width: 21px;
          height: 21px;
          cursor: pointer;
        }
      }
    }
  }
}

</style>
