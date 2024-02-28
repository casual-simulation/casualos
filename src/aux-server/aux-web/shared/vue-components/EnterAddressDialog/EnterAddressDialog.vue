<template>
    <md-dialog
        :md-active.sync="showEnterAddress"
        @md-closed="cancelLogin(true)"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        class="input-dialog"
    >
        <md-dialog-title>Login with {{ loginSiteName }}</md-dialog-title>
        <md-dialog-content class="input-dialog-content">
            <div class="md-layout md-gutter">
                <div class="md-layout-item">
                    <md-field :class="emailFieldClass">
                        <label for="email">{{ emailFieldHint }}</label>
                        <md-input
                            name="email"
                            id="email"
                            autocomplete="email"
                            v-model="address"
                            :disabled="processing"
                        />
                        <field-errors field="address" :errors="formErrors" />
                    </md-field>
                </div>
            </div>
            <div class="terms-of-service-container">
                <field-errors field="termsOfService" :errors="formErrors" />
                <div class="terms-of-service-wrapper">
                    <md-checkbox v-model="acceptedTerms" id="terms-of-service"> </md-checkbox>
                    <label for="terms-of-service">
                        I accept the
                        <a target="_blank" :href="termsOfServiceUrl">Terms of Service</a>
                    </label>
                </div>
            </div>
            <field-errors :field="null" :errors="formErrors" />
            <p>
                <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
            </p>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button
                v-if="supportsWebAuthn"
                type="button"
                @click="loginWithWebAuthn()"
                :disabled="processing"
            >
                <md-progress-spinner
                    v-if="processing"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Login with Passkey</span>
            </md-button>
            <md-button type="button" class="md-primary" @click="login()" :disabled="processing">
                <md-progress-spinner
                    v-if="processing"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Login</span>
            </md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./EnterAddressDialog.ts"></script>
<style src="./EnterAddressDialog.css" scoped></style>
<style src="./EnterAddressDialogGlobals.css"></style>
