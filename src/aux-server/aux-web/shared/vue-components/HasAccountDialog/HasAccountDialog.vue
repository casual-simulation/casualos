<template>
    <md-dialog
        :md-active.sync="showHasAccount"
        @md-closed="cancelHasAccount()"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        class="input-dialog"
    >
        <md-dialog-title>Sign in or Register</md-dialog-title>
        <md-dialog-content class="input-dialog-content">
            <div class="md-layout md-gutter">
                <div class="md-layout-item">
                    <p>You are not logged in. What do you want to do?</p>
                </div>
            </div>
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
                <div class="spacer"></div>
                <div class="policy-cert">
                    <a
                        style="display: inline-block; width: 70px; height: 70px"
                        target="_blank"
                        href="https://cert.privo.com/#/companies/casualsimulation"
                    >
                        <img
                            src="https://privohub.privo.com/files/images/PRIVO_Cert/KPAS_C2V_104_4_72.png"
                            alt="COPPA Safe Harbor Certification - Kids Privacy Assured by PRIVO"
                        />
                    </a>
                </div>
            </div>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button type="button" @click="cancelHasAccount()" :disabled="processing">
                <span>Close</span>
            </md-button>
            <span class="spacer"></span>
            <md-button type="button" @click="hasAccount(true)" :disabled="processing">
                <md-progress-spinner
                    v-if="processing && hasAccountValue === true"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Sign In</span>
            </md-button>
            <md-button type="button" @click="hasAccount(false)" :disabled="processing">
                <md-progress-spinner
                    v-if="processing && hasAccountValue === false"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Create Account</span>
            </md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./HasAccountDialog.ts"></script>
<style src="./HasAccountDialog.css" scoped></style>
<style src="./HasAccountDialogGlobals.css"></style>
