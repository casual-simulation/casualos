<template>
    <md-dialog
        :md-active.sync="showRegisterWebAuthn"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        class="input-dialog"
        @md-closed="onClose()"
    >
        <md-dialog-title>Add Passkey?</md-dialog-title>
        <md-dialog-content class="input-dialog-content">
            <div class="md-layout md-gutter">
                <div class="md-layout-item">
                    <p>Do you want to add a passkey to your account for this device?</p>
                    <p>Passkeys are quick and secure way to login without using a password.</p>
                    <p>
                        Learn more
                        <a
                            href="https://blog.google/technology/safety-security/the-beginning-of-the-end-of-the-password/"
                            target="_blank"
                            referrerpolicy="no-referrer"
                            >here.</a
                        >
                    </p>
                    <field-errors :errors="errors" :field="null" />
                </div>
            </div>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button @click="onClose()" :disabled="processing">Close</md-button>
            <md-button @click="addPasskey" class="md-primary" :disabled="processing">
                <md-progress-spinner
                    v-if="processing"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Add Passkey</span>
            </md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./RegisterWebAuthnDialog.ts"></script>
<style src="./RegisterWebAuthnDialog.css" scoped></style>
<style src="./RegisterWebAuthnDialogGlobals.css"></style>
