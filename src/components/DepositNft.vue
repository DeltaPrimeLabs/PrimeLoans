<template>
  <Mint
    :hasNft="hasDepositNft"
    :nftContract="depositNftContract"
    :mintNFT="mintDepositNft"
    :nftImageUri="depositNftImageUri"
    :type="'DEPOSIT'"
  />
</template>

<script>
import Mint from "../components/Mint";
const ethers = require('ethers');
import {mapActions, mapState} from "vuex";

export default {
  name: 'DepositNft',
  components: {
    Mint
  },
  computed: {
    ...mapState('network', ['provider']),
    ...mapState('nft', ['depositNftContract', 'depositNftImageUri', 'hasDepositNft'])
  },
  methods: {
    ...mapActions('nft', ['getDepositNftId', 'mintDepositNft'])
  }
}
</script>
