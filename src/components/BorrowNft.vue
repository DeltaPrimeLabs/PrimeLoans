<template>
  <div>
    <Mint v-if="showMintBox"
          :hasNft="hasEapNft"
          :nftContract="eapNftContract"
          :mintNFT="mintBorrowNft"
          :nftImageUri="borrowNftImageUri"
          :getNftId="getBorrowNftId"
          :type="'EAP'"
    />
    <NftList :nfts="nfts" :numberOfNfts="numberOfNfts"></NftList>
  </div>
</template>

<script>
import Mint from "../components/Mint";
import NftList from "../components/NftList";
const ethers = require('ethers');
import {mapActions, mapState} from "vuex";

export default {
  name: 'BorrowNft',
  components: {
    Mint,
    NftList
  },
  computed: {
    ...mapState('network', ['provider']),
    ...mapState('nft', ['eapNftContract', 'borrowNftImageUri', 'hasEapNft', 'nfts', 'numberOfNfts']),
  },
  methods: {
    ...mapActions('nft', ['getBorrowNftId', 'mintBorrowNft'])
  },
  data() {
    return {
      showMintBox: true
    }
  },
  mounted() {
    this.showMintBox = this.$route.query.signature
  },
}
</script>
