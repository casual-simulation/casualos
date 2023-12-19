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
            <p>
                <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
            </p>
        </md-dialog-content>
        <md-dialog-actions>
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
