<template>
  <div class="modal-component">
    <div class="modal-container">
      <div class="backdrop">
        <div class="modal">
          <div v-if="closable" class="close-button-container">
            <DeltaIcon class="close-button-container__icon" :icon-src="'src/assets/icons/cross.svg'" :size="21" v-on:click.native="close()"></DeltaIcon>
          </div>
          <div class="modal-scroll">
            <slot></slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import DeltaIcon from "./DeltaIcon.vue";

export default {
  name: 'Modal',
  components: {DeltaIcon},
  methods: {
    close() {
      this.$emit('close');
      this.closeModal();
    }
  },
  props: {
    closable: {
      type: Boolean,
      default: true,
    },
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
  z-index: 2;

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
      -webkit-backdrop-filter: var(--modal__backdrop-backdrop-filter);
      backdrop-filter: var(--modal__backdrop-backdrop-filter);
      background-color: var(--modal__backdrop-background);

      .modal {
        position: absolute;
        width: 750px;
        border-radius: 21px;
        background-color: var(--modal__background-color);

        &::after {
          position: absolute;
          top: -4px;
          bottom: -4px;
          left: -4px;
          right: -4px;
          background-image: var(--modal__border);
          box-shadow: var(--modal__box-shadow);
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

        .close-button-container__icon {
          background: var(--modal__close-button-container-color);
          cursor: pointer;
        }
      }

      .modal-scroll {
        max-height: 75vh;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 100px;
        line-height: normal;

        >:last-child {
          margin-bottom: 60px;
        }

        >:first-child {
          margin-top: 60px;
        }

        &::-webkit-scrollbar {
          width: 12px;
        }

        &::-webkit-scrollbar-thumb {
          border: 4px solid transparent;
          background-clip: padding-box;
          background-color: var(--modal__scroll-bar-background);
          border-radius: 999px;

          &:hover {
            background-color: var(--modal__scroll-bar-hover-background);
          }
        }
      }
    }
  }
}

</style>
