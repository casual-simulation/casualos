<template>
    <md-dialog
        :md-active.sync="showUpdatePassword"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        class="input-dialog"
        @md-closed="onClose()"
    >
        <md-dialog-title>{{
            status.privoProvider === 'privo2' ? 'Finish setting up your sign-in' : 'Account Created'
        }}</md-dialog-title>
        <md-dialog-content class="input-dialog-content">
            <div class="md-layout md-gutter">
                <div class="md-layout-item">
                    <p>
                        {{
                            status.privoProvider === 'privo2'
                                ? 'Your registration is saved, but sign-in setup is not finished.'
                                : 'Your account has been created.'
                        }}
                    </p>
                    <p v-if="status.privoProvider === 'privo2'">
                        Consent approval and sign-in credentials are separate steps. Keep this
                        browser session open until you finish. You can resume setup from the account
                        portal while this session remains available.
                    </p>

                    <p v-if="providedParentEmail">
                        Ask your parent to check their email for a message from
                        <a
                            href="https://www.privo.com/parents#why-is-parent-permission-required"
                            target="_blank"
                            >Casual Simulation Support (support@privo.com)</a
                        >. If they don't see it, ask them to check the spam folder.
                    </p>
                    <p v-else>
                        Check your email for a message from
                        <a
                            href="https://www.privo.com/parents#why-is-parent-permission-required"
                            target="_blank"
                            >Casual Simulation Support (support@privo.com)</a
                        >. If you don't see it, check your spam folder.
                    </p>

                    <p v-if="setupPending">
                        Your registration was saved. Credential setup is temporarily unavailable.
                    </p>
                    <p v-else>
                        {{
                            status.privoProvider === 'privo2'
                                ? 'Create your sign-in credentials to finish setting up your account.'
                                : 'Do you want to set your account password?'
                        }}
                    </p>
                    <p v-if="retryFailed">
                        Credential setup is still unavailable. Please try again.
                    </p>
                </div>
            </div>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button v-if="setupPending" :disabled="processing" @click="retryCredentialSetup"
                >Retry Credential Setup</md-button
            >
            <md-button
                v-else
                :href="updatePasswordUrl"
                target="_blank"
                class="md-raised md-primary"
                @click="status.privoProvider === 'privo2' ? null : (showUpdatePassword = false)"
            >
                {{
                    status.privoProvider === 'privo2'
                        ? 'Create sign-in credentials'
                        : 'Set Password'
                }}
            </md-button>
            <md-button type="button" @click="showUpdatePassword = false">{{
                status.privoProvider === 'privo2' ? 'Close — setup still required' : 'Close'
            }}</md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./UpdatePasswordLinkDialog.ts"></script>
<style src="./UpdatePasswordLinkDialog.css" scoped></style>
<style src="./UpdatePasswordLinkDialogGlobals.css"></style>
