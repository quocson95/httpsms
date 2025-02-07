<template>
  <div>
    <div id="firebaseui-auth-container" ref="authContainer"></div>
    <v-progress-circular
      v-if="!firebaseUIInitialized"
      class="mx-auto d-block my-16"
      :size="80"
      :width="5"
      color="primary"
      indeterminate
    ></v-progress-circular>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'
import { ProviderId } from 'firebase/auth'
import { auth } from 'firebaseui'
import firebase from 'firebase/compat'
import { NotificationRequest } from '~/store'

@Component
export default class FirebaseAuth extends Vue {
  ui: auth.AuthUI | null = null
  firebaseUIInitialized = false

  @Prop({ required: false, type: String, default: '/' }) to!: string

  beforeDestroy(): void {
    if (this.ui) {
      this.ui.delete()
    }
  }

  mounted(): void {
    if (process.browser) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const firebaseui = require('firebaseui')
      require('firebaseui/dist/firebaseui.css')
      this.ui = new firebaseui.auth.AuthUI(this.$fire.auth)
      this.ui?.start('#firebaseui-auth-container', this.uiConfig())
    }
  }

  uiConfig(): any {
    return {
      callbacks: {
        signInSuccessWithAuthResult: (
          authResult: firebase.auth.UserCredential
        ) => {
          this.$store.dispatch('addNotification', {
            message: 'Login successfull!',
            type: 'success',
          } as NotificationRequest)

          this.$store.dispatch('onAuthStateChanged', {
            authUser: authResult.user,
          })

          this.$router.push({ path: this.to })
          return false
        },
        uiShown: () => {
          // The widget is rendered.
          // Hide the loader.
          this.firebaseUIInitialized = true
          const container = this.$refs.authContainer as HTMLElement
          Array.from(
            container.getElementsByClassName('firebaseui-idp-text-long')
          ).forEach((item: Element) => {
            item.textContent =
              item.textContent?.replace('Sign in with', 'Continue with') || null
          })
        },
      },
      // Will use popup for IDP Providers sign-in flow instead of the default, redirect.
      signInFlow: 'popup',
      signInSuccessUrl: window.location.href,
      signInOptions: [
        // Leave the lines as is for the providers you want to offer your users.
        ProviderId.GITHUB,
        ProviderId.GOOGLE,
        ProviderId.PASSWORD,
      ],
      // Terms of service url.
      tosUrl: this.$store.getters.getAppData.url + '/terms-and-conditions',
      // Privacy policy url.
      privacyPolicyUrl: this.$store.getters.getAppData.url + '/privacy-policy',
    }
  }
}
</script>
