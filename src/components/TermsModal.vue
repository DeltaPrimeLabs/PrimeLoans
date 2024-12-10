<template>
  <div id="modal" class="terms-modal-component modal-component">
    <Modal>
      <div class="modal__title">
        Accept Terms
      </div>

      <div class="modal__content">
        <div class="content__part content__part--first">
          Gm fren! In order to stay fully compliant, we had to update our terms and conditions.
          Please give it a read below and sign the new T&C with your wallet. Apologies for any inconvenience!
        </div>

        <div class="content__part">
          If you don’t accept the changes, you should discontinue using our services and withdraw your funds within 14 days.
        </div>

        <div class="content__part">
          Good to know: while DeltaPrime charges a small liquidation bonus, there are no additional fees for trading or borrowing.
        </div>
        <div class="content__part content__part--last">Stay safe Degen!</div>
      </div>

      <a href="https://deltaprime.io/legals/terms-Of-Use" class="terms-link" target="_blank">
        Link to terms
      </a>

      <div class="button-wrapper">
        <Button :label="'Accept terms'" v-on:click="submit()" :waiting="buttonWaiting"></Button>
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

  props: {},

  data() {
    return {
      buttonWaiting: false
    }
  },

  mounted() {

  },

  computed: {},

  methods: {
    submit() {
      this.buttonWaiting = true;
      this.$emit('SIGN_TERMS');
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";
@import "~@/styles/modal";

.modal__content {
  text-align: justify;
}

.terms-link {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  color: var(--default-text-color);
  font-weight: 600;
  font-size: $font-size-md;

  &:hover {
    text-decoration: underline;
    cursor: pointer;
  }
}

.content__part {
  &:not(:first-child) {
    margin-top: 20px;
  }

  &.content__part--first {
    font-weight: 600;
  }

  &.content__part--last {
    text-align: end;
  }
}

</style>