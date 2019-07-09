<template>
    <div>
        <form novalidate class="md-layout login-form" @submit.prevent="createUser">
            <md-card>
                <md-card-header>
                    <div class="md-title">Create Account</div>
                </md-card-header>

                <md-card-content>
                    <div v-if="!showProgress">
                        <div>
                            <md-field>
                                <label for="name">Name</label>
                                <md-input
                                    name="name"
                                    id="name"
                                    autocomplete="name"
                                    v-model="email"
                                />
                            </md-field>
                        </div>
                        <div v-if="needsGrant" class="needs-grant-section">
                            <span>This account is already in use.</span>
                            <a class="md-primary grant-button" @click="scanGrant"
                                >Authorize Device</a
                            >
                        </div>
                        <div class="continue-as-guest-section">
                            <span>Don't want an account?</span>
                            <a class="md-primary guest-button" @click="continueAsGuest"
                                >Continue as a Guest</a
                            >
                        </div>
                    </div>
                    <div v-else class="progress-section">
                        <p>Logging in...</p>
                        <md-progress-spinner md-mode="indeterminate"></md-progress-spinner>
                    </div>
                </md-card-content>

                <md-card-actions>
                    <md-button v-if="!showProgress" type="submit" class="md-primary md-raised"
                        >Next</md-button
                    >
                </md-card-actions>
            </md-card>
        </form>

        <md-dialog
            :md-active.sync="showQRScanner"
            class="qr-scanner-dialog"
            @md-closed="onQrCodeScannerClosed()"
        >
            <div class="qr-scanner-container">
                <h3>Scan a QR Code</h3>
                <qrcode-stream @decode="onQRCodeScanned"></qrcode-stream>
            </div>
            <md-dialog-actions>
                <md-button class="md-primary" @click="hideQRCodeScanner()">Close</md-button>
            </md-dialog-actions>
        </md-dialog>

        <!-- <form novalidate class="md-layout" @submit.prevent="validateUser">
      <md-card class="md-layout-item md-size-50 md-small-size-100">
        <md-card-header>
          <div class="md-title">Users</div>
        </md-card-header>

        <md-card-content>
          <div class="md-layout md-gutter">
            <div class="md-layout-item md-small-size-100">
              <md-field>
                <label for="first-name">First Name</label>
                <md-input name="first-name" id="first-name" autocomplete="given-name" v-model="form.firstName" :disabled="sending" />
                <span class="md-error" v-if="!$v.form.firstName.required">The first name is required</span>
                <span class="md-error" v-else-if="!$v.form.firstName.minlength">Invalid first name</span>
              </md-field>
            </div>
        </md-card-content>

        <md-card-actions>
          <md-button type="submit" class="md-primary" :disabled="sending">Create user</md-button>
        </md-card-actions>
      </md-card>

      <md-snackbar :md-active.sync="userSaved">The user {{ lastUser }} was saved with success!</md-snackbar>
    </form> -->
    </div>
</template>
<script src="./BuilderWelcome.ts"></script>
<style src="./BuilderWelcome.css" scoped></style>
