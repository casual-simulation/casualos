<template>
    <md-dialog
        :md-active.sync="showUpdatePassword"
        :md-close-on-esc="true"
        :md-click-outside-to-close="true"
        :md-fullscreen="true"
        class="input-dialog"
        @md-closed="onClose()"
    >
        <md-dialog-title>Account Created</md-dialog-title>
        <md-dialog-content class="input-dialog-content">
            <div class="md-layout md-gutter">
                <div class="md-layout-item">
                    <p>Your account has been created. Do you want to set your account password?</p>
                </div>
            </div>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button
                :href="updatePasswordUrl"
                target="_blank"
                class="md-primary"
                @click="showUpdatePassword = false"
            >
                Set Password
            </md-button>
            <md-button type="button" @click="showUpdatePassword = false">Close</md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./UpdatePasswordLinkDialog.ts"></script>
<style src="./UpdatePasswordLinkDialog.css" scoped></style>
<style src="./UpdatePasswordLinkDialogGlobals.css"></style>
