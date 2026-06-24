<template>
    <md-dialog
        :md-active.sync="showEnterAddress"
        @md-closed="cancelLogin()"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        class="input-dialog"
    >
        <form class="enter-address-form" @submit.prevent="login">
            <md-dialog-title>Login with {{ loginSiteName }}</md-dialog-title>
            <md-dialog-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <md-field :class="emailFieldClass">
                            <label for="email">{{ emailFieldHint }}</label>
                            <md-input
                                name="email"
                                id="email"
                                :type="supportsSms ? 'text' : 'email'"
                                autocomplete="email webauthn"
                                inputmode="email"
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
                <div class="policies-grid" style="margin-top: 24px">
                    <div>
                        <p v-if="privacyPolicyUrl">
                            <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                        </p>
                        <p v-if="codeOfConductUrl">
                            <a target="_blank" :href="codeOfConductUrl">Code of Conduct</a>
                        </p>
                        <p v-if="termsOfServiceUrl">
                            <a target="_blank" :href="termsOfServiceUrl">Terms of Service</a>
                        </p>
                        <p v-if="supportUrl">
                            <a target="_blank" :href="supportUrl">Support</a>
                        </p>
                    </div>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button type="button" @click="cancelLogin()" :disabled="processing">
                    <span>Close</span>
                </md-button>
                <span class="spacer"></span>
                <md-button
                    v-if="supportsWebAuthn"
                    type="button"
                    @click="webAuthnLogin()"
                    :disabled="processing || loadingWebAuthn"
                >
                    <md-progress-spinner
                        v-if="(processing && processingKind === 'webauthn') || loadingWebAuthn"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Login with Passkey</span>
                </md-button>
                <md-button type="button" class="md-primary" @click="login()" :disabled="processing">
                    <md-progress-spinner
                        v-if="processing && processingKind === 'login'"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Login</span>
                </md-button>
            </md-dialog-actions>
        </form>
    </md-dialog>
</template>
<script src="./EnterAddressDialog.ts"></script>
<style src="./EnterAddressDialog.css" scoped></style>
<style src="./EnterAddressDialogGlobals.css"></style>
