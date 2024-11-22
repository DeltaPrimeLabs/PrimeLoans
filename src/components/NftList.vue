<template>
  <div id="NftList" class="nft-list">
    <div class="page-title">
      <div v-if="nfts && nfts.length > 0">Your NFTs</div>
      <div class="no-nfts-header" v-if="nfts && nfts.length === 0">
        You don't have any DeltaPrime NFTs. Go to our
        <a class="discord-link" href="https://discord.gg/57EdDsvhxK" target="_blank">Discord</a>
        to find out how to get them!
      </div>
    </div>

    <div class="nfts-grid">
      <div class="nft nft-video" v-for="(nft, index) in numberOfNfts">
        <div class="nft nft-placeholder" v-if="numberOfNftVideosLoaded !== numberOfNfts">
          <Loader class="loader"></Loader>
          <div class="nft-placeholder-background"></div>
          <div class="nft-placeholder-white-box"></div>
        </div>
        <video :id="'nft-video-' + index"
               class="video"
               v-bind:class="{ hidden: numberOfNftVideosLoaded !== numberOfNfts }"
               :src="nfts[index]"
               muted
               loop
               v-on:mouseover="pauseVideo(index)"
               v-on:mouseleave="playVideo(index)"
               v-on:loadeddata="setupVideo()">
        </video>
      </div>
      <div v-for="placeholder in numberOfPlaceholders" class="nft nft-placeholder">
        <div class="nft-placeholder-background"></div>
        <div class="nft-placeholder-white-box"></div>
      </div>
    </div>
  </div>
</template>

<script>


import Loader from "./Loader";

export const LG_BRAKEPOINT = 992;
export const SM_BRAKEPOINT = 576;

export default {
  name: 'NftList',
  components: {
    Loader
  },
  props: {
    nfts: {
      default: [],
    },
    numberOfNfts: {
      type: Number,
      default: 0,
    }
  },
  data() {
    return {
      numberOfPlaceholders: 3,
      allNftsLoaded: false,
      numberOfNftVideosLoaded: 0,
    }
  },
  computed: {},
  methods: {
    setupNumberOfPlaceholders() {
      let innerWidth = window.innerWidth;
      if (this.numberOfNfts === 0) {
        if (innerWidth > LG_BRAKEPOINT) {
          this.numberOfPlaceholders = 3;
        } else if (innerWidth < LG_BRAKEPOINT && innerWidth > SM_BRAKEPOINT) {
          this.numberOfPlaceholders = 2;
        } else {
          this.numberOfPlaceholders = 1;
        }
      } else {
        if (innerWidth > LG_BRAKEPOINT) {
          this.numberOfPlaceholders = (6 - this.numberOfNfts) % 3;
        } else if (innerWidth < LG_BRAKEPOINT && innerWidth > SM_BRAKEPOINT) {
          this.numberOfPlaceholders = (6 - this.numberOfNfts) % 2;
        } else {
          this.numberOfPlaceholders = 0;
        }
      }
    },

    setupVideo() {
      this.numberOfNftVideosLoaded++;
      this.setupNumberOfPlaceholders();
      if (this.numberOfNftVideosLoaded === this.numberOfNfts) {
        for (let i = 0; i < this.numberOfNftVideosLoaded; i++) {
          const videoPlayer = document.getElementById(`nft-video-${i}`)
          videoPlayer.play();
        }
      }
    },

    playVideo(index) {
      const videoPlayer = document.getElementById(`nft-video-${index}`)
      videoPlayer.play();
    },

    pauseVideo(index) {
      const videoPlayer = document.getElementById(`nft-video-${index}`)
      videoPlayer.pause();
    },
  },
  watch: {
    nfts: {
      handler() {
        this.setupNumberOfPlaceholders();
      }
    }
  },
  mounted() {
    this.setupNumberOfPlaceholders();
  }
}
</script>
<style lang="scss" scoped>
@import "~@/styles/variables";

.nft-list {
  max-width: 970px;
  margin: auto;

  @media screen and (max-width: $lg) {
    padding: 0 20px;
  }
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  width: 100%;
  text-align: center;
  margin-bottom: 40px;

  .no-nfts-header {
    font-size: 20px;


    .discord-link {
      display: inline;
      color: #6B70ED;
      cursor: pointer;
      text-decoration: none;
    }
  }
}

.nfts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  column-gap: 40px;
  row-gap: 40px;
  padding-bottom: 40px;

  @media screen and (max-width: $lg) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media screen and (max-width: $sm) {
    grid-template-columns: repeat(1, 1fr);
  }


  .nft {
    width: 100%;
    height: 450px;
    border-radius: 23px;
  }

  .nft-video {
    position: relative;

    .nft-placeholder {
      position: absolute;
      top: 0;
      left: 0;
    }
  }

  .video {
    width: 100%;
    height: 450px;
    object-fit: cover;
    border-radius: 23px;

    &.hidden {
     visibility: hidden;
    }
  }

  .nft-placeholder {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    .loader {
      z-index: 2;
    }

    .nft-placeholder-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.10;
      background-image: linear-gradient(152deg, #7476fc 23%, #ff6f43 65%, #f5217f 96%);
      z-index: 1;
      border-radius: 23px;
    }

    .nft-placeholder-white-box {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: white;
      border-radius: 23px;
    }
  }
}
</style>
