<template>
  <div class="rtkn-stats-bar-component">
    <div class="rtkn__title">
      Prime Conversion Program
      <div class="gauge">
        <BarGaugeBeta
          v-tooltip="{content: `Subscription status <br> <b>${crossChainData.totalPledged | smartRound(2, true)} / ${crossChainData.maxCap} rTKN</b>`, classes: 'info-tooltip'}"
          :min="0"
          :max="crossChainData.maxCap"
          :value="crossChainData.totalPledged"
          :width="80"
          :green-on-completion="true"
          :medium="true"
          :overflow-mode="true">
        </BarGaugeBeta>
      </div>
    </div>
    <TableHeader :config="rtknTableHeader"></TableHeader>

    <div class="rtkn-table">
      <div v-for="rtknData in data" :key="rtknData.symbol" class="rtkn-row">
        <div>{{ rtknData.launchDate }}</div>
        <div class="">
          {{rtknData.yourPledge | smartRound(3, true)}} {{ rtknData.symbol }}
        </div>
        <div>
          {{ rtknData.rtknUtilized | smartRound(3, true) }} {{ rtknData.symbol}}
          <InfoIcon class="info__icon"
                    :tooltip="{content: 'The rTKNs that are not utilized will be returned to your wallet.', classes: 'info-tooltip'}"
                    :classes="'info-tooltip'"></InfoIcon>
        </div>
        <div>{{ rtknData.eligiblePrime | smartRound(5, true) }}</div>
        <div>
          <BarGaugeBeta
            v-tooltip="{content: `Subscription status <br> <b>${rtknData.totalPledged | smartRound(2, true)} / ${rtknData.maxCap} rTKN</b>`, classes: 'info-tooltip'}"
            :min="0"
            :max="rtknData.maxCap"
            :value="rtknData.totalPledged"
            :width="80"
            :green-on-completion="true"
            :medium="true"
            :overflow-mode="true">
          </BarGaugeBeta>
        </div>
        <div>{{ rtknData.totalUsers }}</div>
        <div>
          <FlatButton v-on:buttonClick="openPledgeModal(rtknData)" :active="true">Commit</FlatButton>
        </div>
        <div v-on:click="openCancelModal(rtknData)">
          <DeltaIcon class="cross-icon" :icon-src="'src/assets/icons/cross.svg'" :size="19"></DeltaIcon>
        </div>
      </div>
    </div>
  </div>
</template>

<script>


import BarGaugeBeta from './BarGaugeBeta.vue';
import InfoIcon from './InfoIcon.vue';
import config from '../config';
import Button from './Button.vue';
import erc20ABI from '../../test/abis/ERC20.json';
import RtknPledgeModal from './RtknPledgeModal.vue';
import {mapState} from 'vuex';
import {smartRound} from '../utils/calculate';
import TableHeader from './TableHeader.vue';
import FlatButton from './FlatButton.vue';
import DeltaIcon from './DeltaIcon.vue';
import RtknCancelModal from './RtknCancelModal.vue';

const ethers = require('ethers');


export default {
  name: 'RTKNStatsBar',
  components: {DeltaIcon, FlatButton, TableHeader, Button, InfoIcon, BarGaugeBeta},
  data() {
    return {
      rtknTableHeader: null,
    }
  },
  props: {
    data: {},
    crossChainData: {},
  },
  mounted() {
    this.setupHeader();
  },
  computed: {
    ...mapState('serviceRegistry', ['accountService', 'rtknService']),
  },
  methods: {
    smartRound,
    async openPledgeModal(rtknData) {
      console.log('test');
      const modalInstance = this.openModal(RtknPledgeModal);
      modalInstance.available = rtknData.rtknBalance;
      modalInstance.yourPledge = rtknData.yourPledge;
      modalInstance.conversionRatio = rtknData.conversionRatio;
      modalInstance.totalPledged = rtknData.totalPledged;
      modalInstance.maxCap = rtknData.maxCap;

      modalInstance.$on('PLEDGE', (pledgeEvent) => {
        this.rtknService.pledge(pledgeEvent.value, rtknData.symbol);
      });
    },

    async openCancelModal(rtknData) {
      const modalInstance = this.openModal(RtknCancelModal);
      console.log(this.yourPledge);
      modalInstance.available = rtknData.yourPledge;
      modalInstance.conversionRatio = rtknData.conversionRatio;

      modalInstance.$on('CANCEL', (cancelEvent) => {
        this.rtknService.cancel(cancelEvent.value, rtknData.symbol);
      });
    },

    setupHeader() {
      this.rtknTableHeader = {
        gridTemplateColumns: 'repeat(6, 1fr) 80px 60px 17px',
        cells: [
          {
            label: 'Launch Date',
            class: 'justify-content-flex-start'
          },
          {
            label: 'Commited',
            class: 'justify-content-center'
          },
          {
            label: 'Utilized',
            class: 'justify-content-center'
          },
          {
            label: 'PRIME expected',
            class: 'justify-content-center'
          },
          {
            label: 'Filled',
            class: 'justify-content-center'
          },
          {
            label: 'Participants',
            class: 'justify-content-center'
          },
          {
            label: 'Commit',
            class: 'justify-content-center'
          },
          {
            label: 'Cancel',
            class: 'justify-content-flex-end'
          },
          {
            label: '',
          },
        ]
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.rtkn-stats-bar-component {
  display: flex;
  flex-direction: column;
  margin-top: 30px;
  margin-bottom: 30px;
  padding: 0 53px;
  border-radius: 35px;
  background-color: var(--rtkn-stats-bar__background);
  box-shadow: 7px 7px 30px 0 #{$dark-space}66;

  .rtkn__title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    color: var(--rtkn-stats-bar-text__color);
    font-size: $font-size-sm;
    font-weight: 600;
    padding: 14px 0 20px 0;

    .gauge {
      margin-left: 14px;
    }
  }

  .rtkn-table {
    padding: 0 7px;

    .rtkn-row {
      display: grid;
      grid-template-columns: repeat(6, 1fr) 80px 60px;
      padding: 21px 10px;

      div {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        font-weight: 500;
      }

      div:first-child {
        justify-content: flex-start;
      }

      div:last-child {
        justify-content: flex-end;
      }

      &:first-child {
        //border-style: solid;
        //border-width: 0 0 2px 0;
        //border-image-source: var(--asset-table-row__border);
        //border-image-slice: 1;
      }
    }
  }
  .cross-icon {
    background: var(--rtkn-stats-bar-cancel-icon-color);
    cursor: pointer;
  }

  .info__icon {
    margin-left: 5px;
  }
}

</style>
