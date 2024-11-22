<template>
  <div class="mint container">
    <Block class="block" :bordered="true">
      <div class="title">{{ title }}</div>
      <div class="nft">
        <video muted autoplay loop :src="videoUri"/>
      </div>
      <div class="description">
        <div v-html="description" v-if="description"></div>
        <vue-loaders-ball-beat v-else color="#A6A3FF" scale="0.5"></vue-loaders-ball-beat>
      </div>
      <Button :waiting="waiting" :disabled="hasNft || waiting || !correctLink" label="Mint" v-on:click="mint"/>
    </Block>
  </div>
</template>

<script>
import Block from '../components/Block';
import Button from '../components/Button';
import {mapState} from 'vuex';
import Vue from 'vue';

const ethers = require('ethers');

export default {
  name: 'Nft',
  components: {
    Button,
    Block
  },
  props: {
    hasNft: {
      type: Boolean
    },
    nftImageUri: {
      type: String,
      default: null
    },
    nftContract: {
      default: null
    },
    mintNFT: {
      type: Function
    },
    type: {
      type: String,
    }
  },
  data() {
    return {
      exampleNft: '',
      userNft: '',
      incorrectLink: 'Go to our ' +
        '<a href=\'https://discord.gg/57EdDsvhxK\' target=\'_blank\'>Discord server</a> to get your link for minting!',
      notMintedYetMessage: 'Get your own unique NFT to try out our platform!',
      mintedMessage: 'Your unique access NFT is minted! Go to <a href=\'/#/prime-account\'>Prime Account</a> to start trading.',
      intervalId: null,
      waiting: false
    };
  },
  computed: {
    ...mapState('network', ['provider']),
    description() {
      if (!this.correctLink && !this.hasNft) return this.incorrectLink;
      return this.hasNft ? this.mintedMessage : this.notMintedYetMessage;
    },

    videoUri() {
      return this.nftImageUri ? this.nftImageUri : 'https://arweave.net/mOoFf_oH77bi1nhDWeR5xRgX7yv7924XtOkdb6fDLfg';
    },

    correctLink() {
      const query = this.$route.query;

      return query.id && query.signature;
    },

    title() {
      switch (this.type) {
        case 'EAP':
          return this.hasNft ? 'Your access NFT' : 'Early Access Program NFT';

        case 'DEPOSIT':
          return this.hasNft ? 'Your deposit NFT' : 'Deposit NFT';
      }
    }
  },
  methods: {
    async mint() {
      if (!this.hasNft) {
        this.waiting = true;
        const query = this.$route.query;

        await this.handleTransaction(this.mintNFT, {id: query.id, signature: query.signature},
          async () => {
            this.waiting = false;
            this.hasNft = true;
          },
          async () => {
            Vue.$toast.error('Minting failed. Check Metamask for more info');
          }
        );
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import "~@/styles/variables";

.title {
  margin-bottom: 30px;
}

.description {
  text-align: center;
  margin-bottom: 30px;
  margin-top: 30px;
}

.nft {
  height: 300px;
  border-radius: 15px;
  overflow: hidden;

  video {
    height: 100%;
  }
}

</style>
<style lang="scss">
.mint {
  .nft {
    .vue-loaders {
      margin-top: 100%;
    }
  }

  .description {
    a {
      text-decoration: none;
      color: black;
      font-weight: 600;
    }
  }
}
</style>
