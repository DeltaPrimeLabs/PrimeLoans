<template>
<div class="theme-toggle" v-on:click="toggleTheme()">
  <div class="theme-toggle__switch">
    <img class="theme-icon theme-icon--dark" src="src/assets/icons/moon.svg">
    <img class="theme-icon theme-icon--light" src="src/assets/icons/sun.svg">
  </div>
</div>
</template>

<script>
import DeltaIcon from "./DeltaIcon.vue";
import {mapState} from "vuex";

export default {
  name: "ThemeToggle",
  components: {DeltaIcon},
  methods: {
    toggleTheme() {
      this.darkMode = !this.darkMode;
      this.themeService.emitThemeChange(this.darkMode ? 'DARK' : 'LIGHT');
    },
  },
  created() {
    const localStorageTheme = localStorage.getItem('VIEW_THEME')
    if (localStorageTheme) {
      this.darkMode = localStorageTheme === 'DARK'
    } else {
      this.darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    localStorage.setItem('VIEW_THEME', this.darkMode ? 'DARK' : 'LIGHT')
    this.themeService.emitThemeChange(this.darkMode ? 'DARK' : 'LIGHT');
    document.documentElement.classList.add(this.darkMode ? 'theme--dark' : 'theme--light')
  },
  computed: {
    ...mapState('serviceRegistry', [
      'themeService'
    ]),
  }
}
</script>

<style scoped lang="scss">
.theme-toggle {
  position: relative;
  height: 27px;
  width: 47px;
  background: var(--theme-toggle__background);
  border-radius: 999px;
  cursor: pointer;
  user-select: none;
}

.theme-toggle__switch {
  position: absolute;
  top: 3px;
  width: 21px;
  height: 21px;
  border-radius: 999px;
  box-shadow: var(--theme-toggle__switch-box-shadow);
  background-image: var(--theme-toggle__switch-background);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: left 200ms ease-in-out;
}

.theme-icon {
  transition: all 200ms ease-in-out;
  position: absolute;
  top: 0;
  left: 0;
}

:root.theme--light {
  .theme-toggle__switch {
    left: 3px;
  }

  .theme-icon--light {
    opacity: 1;
    transform: scale(1);
  }

  .theme-icon--dark {
    opacity: 0;
    transform: scale(0);
  }
}

:root.theme--dark {
  .theme-toggle__switch {
    left: 22px;
  }

  .theme-icon--dark {
    opacity: 1;
    transform: scale(1);
  }

  .theme-icon--light {
    opacity: 0;
    transform: scale(0);
  }
}

</style>
