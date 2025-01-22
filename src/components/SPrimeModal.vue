<template>
  <div id="modal" class="sprime-modal-component">
    <Modal v-on:close="modalClosed">
      <div class="modal__content">
        <div class="sprime-title">
          Get Your $PRIME
        </div>
        <div class="sprime-subtitle">
          Today On
        </div>

        <div class="actions">
          <Button :label="'Arbitrum'" v-on:click="redirectToUniswap" class="link-button">Arbitrum</Button>
          <Button :label="'Avalanche'" v-on:click="redirectToTraderJoe" class="link-button">Avalanche</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script>
import Modal from './Modal';
import Button from './Button';

export default {
  name: 'TermsModal',
  components: {
    Button,
    Modal,
  },

  props: {
    allowWithdrawals: {
      type: Boolean,
      default: null
    }
  },

  data() {
    return {
      buttonWaiting: false
    }
  },

  mounted() {

  },

  computed: {
  },

  methods: {

    redirectToUniswap() {
      window.open('https://app.uniswap.org/swap?chain=arbitrum&outputCurrency=0x3De81CE90f5A27C5E6A5aDb04b54ABA488a6d14E', '_blank').focus();
      this.$emit('CLOSE');
      this.closeModal();
    },

    redirectToTraderJoe() {
      window.open('https://lfj.gg/avalanche/trade?chain=avalanche&outputCurrency=0x33C8036E99082B0C395374832FECF70c42C7F298', '_blank').focus();
      this.$emit('CLOSE');
      this.closeModal();
    },

    modalClosed() {
      this.$emit('CLOSE');
    }
  }
};
</script>

<style scoped lang="scss">

.sprime-modal-component {

  .modal__content {
    color: var(--sprime-modal__text-color);
    font-size: 60px;
    padding-top: 24px;
  }

  .sprime-title {
    line-height: 73.14px;
    font-weight: 700;
    text-align: center;
  }

  .sprime-subtitle {
    line-height: 73.14px;
    font-weight: 400;
    text-align: center;
  }

  .actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-top: 48px;

    .link-button {
      font-size: 24px;
      font-weight: 500;
      padding: 12px 32px;
    }
  }
}
</style>