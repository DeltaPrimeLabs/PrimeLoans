<template>
  <div class="rtkn-panel-faq-component">
    <div v-if="!openEntry">
      <div v-for="entry in faq" class="faq__entry">
        <div class="faq__question" @click="open(entry)">
          {{ entry.question }}
          <div class="faq__icon-wrapper">
            <DeltaIcon :icon-src="'src/assets/icons/left-arrow.svg'"
                       class="faq__icon">
            </DeltaIcon>
          </div>
        </div>
      </div>
    </div>

    <div v-if="openEntry" class="faq__entry faq__entry--open" @click="open(null)">
      <div class="faq__question">
        {{ openEntry.question }}
        <DeltaIcon :icon-src="'src/assets/icons/cross.svg'"
                   class="faq__icon">
        </DeltaIcon>
      </div>
      <div class="faq__answer">{{ openEntry.answer }}</div>
    </div>
  </div>
</template>

<script>


import DeltaIcon from './DeltaIcon.vue';

export default {
  name: 'RTKNPanelFAQ',
  components: {DeltaIcon},
  props: {
    question: String,
    answer: String,
  },
  data() {
    return {
      faq: [
        {
          question: 'When will I receive my PRIME tokens?',
          answer: `The PRIME to receive will come from the Team allocation and will therefore follow its vesting schedule.\n
            It starts unlocking on July 1st, 2025. Over a period of 730 days, you can claim a 1/730th share of your PRIME.`
        },
        {
          question: 'How can I use the PRIME I will receive?',
          answer: `Like every vested PRIME recipient, PRIME only be used once it is claimed. This goes for creating sPRIME, using PRIME features, and any other utility built into the DeltaPrime ecosystem over time.
                    Once claimed, your PRIME is fully liquid and can be used however you want!`
        },
        {
          question: 'Where can I redeem my rTKNs?',
          answer: 'If committed, rTKNs are automatically converted to PRIME. All remaining rTKNs can, starting in the next weeks, be used to claim a portion of the revenue in this panel. The middle section of this panel, currently showing PCP subscription statistics, will be replaced with the stats and tools necessary to redeem the rTKNs.'
        },
      ],
      openEntry: null,
    };
  },
  mounted() {
  },
  watch: {},
  computed: {},
  methods: {
    open(entry) {
      this.openEntry = entry;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.rtkn-panel-faq-component {
  &:not(:last-child) {
    margin-bottom: 12px;
  }

  .faq__entry {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding: 10px 16px;
    border-radius: 15px;
    color: var(--s-prime-panel__main-text-color);
    border: var(--rtkn-panel__faq-border);
    box-shadow: var(--rtkn-panel__faq-box-shadow);
    cursor: pointer;
    font-weight: 500;

    &:not(:last-child) {
      margin-bottom: 12px;
    }
  }

  .faq__question {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    .faq__icon {
      background: var(--icon-button__icon-color--default);
      transform: rotate(180deg);
    }
  }

  .faq__answer {
    margin-top: 8px;
    color: var(--rtkn-panel__value--secondary-color);
  }
}


</style>
