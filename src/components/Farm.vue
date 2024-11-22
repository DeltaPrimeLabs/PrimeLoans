<template>
  <div class="stake-beta-component">
    <div class="filters">
      <div class="filter-container">
        <div class="filter__label">Filter by assets:</div>
        <AssetFilter ref="assetFilter" :asset-filter-groups="assetFilterGroups" v-on:filterChange="setFilter"></AssetFilter>
      </div>
    </div>
    <StakingAssetBeta v-for="asset in filteredStakedAssets"
                      v-bind:key="asset[0]"
                      :assetSymbol="asset[0]"
                      :farmingConfig="asset[1]">
    </StakingAssetBeta>
  </div>
</template>

<script>
import StakingAssetBeta from './StakingAssetBeta';
import config from '../config';
import AssetFilter from './AssetFilter';
import {mapActions} from "vuex";

export default {
  name: 'Farm',
  components: {StakingAssetBeta, AssetFilter},
  computed: {
    filteredStakedAssets() {
      return Object.entries(config.FARMED_TOKENS_CONFIG).filter(farm =>
          this.selectedAssets.includes(farm[0])
          || (config.LP_ASSETS_CONFIG[farm[0]] != null &&
            (this.selectedAssets.includes(config.LP_ASSETS_CONFIG[farm[0]].primary)
              || this.selectedAssets.includes(config.LP_ASSETS_CONFIG[farm[0]].secondary)
            )
          )
      );
    },
  },
  mounted() {
    this.setupAssetFilterGroups();
  },
  data() {
    return {
      selectedAssets: [] = [],
      assetsFilterOptions: [] = [],
      assetFilterGroups: null,
    };
  },
  methods: {
    ...mapActions('stakeStore', ['updateStakedBalances']),
    setFilter(filter) {
      this.selectedAssets = filter.asset;
    },
    setupAssetFilterGroups() {
      this.assetFilterGroups = [
        {
          label: 'Filter by assets',
          options: ['AVAX', 'USDC', 'ETH', 'sAVAX'],
          key: 'asset'
        },
      ];

      this.selectedLpTokens = this.assetFilterGroups[0].options;
      setTimeout(() => {
        this.$refs.assetFilter.assetFilterGroups = this.assetFilterGroups;
        this.$refs.assetFilter.setupFilterValue();
        this.selectedAssets = this.assetFilterGroups[0].options;
      });
    },
  },



  watch: {}
};
</script>

<style lang="scss" scoped>

.stake-beta-component {
  width: 100%;
}

.filters {
  margin-bottom: 10px;
}

</style>